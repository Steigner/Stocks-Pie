package com.github.steigner.stockspie

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import androidx.activity.result.ActivityResult
import app.tauri.Logger
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.util.concurrent.Executors
import org.json.JSONException
import org.json.JSONObject

private const val FILE_NAME = "portfolio.json"
private const val PARTIAL_NAME = "portfolio.json.partial"
private const val PREFERENCES = "folder"
private const val FOLDER_KEY = "tree"
private const val READ_WRITE =
  Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION

@InvokeArg
class WriteArgs {
  lateinit var text: String
}

/**
 * Android's counterpart to the plain file access in desktop.rs. Android hands out
 * a content address rather than a path, so this holds the address of the folder
 * the user picked and only ever touches portfolio.json in it. It is reached only
 * through the app's own Rust commands, so the page never sees the address.
 */
@TauriPlugin
class FolderPlugin(private val activity: Activity) : Plugin(activity) {
  // From the application: this activity may long be gone, as the plugin outlives it.
  private val context = activity.applicationContext
  private val resolver get() = context.contentResolver
  private val preferences get() = context.getSharedPreferences(PREFERENCES, Activity.MODE_PRIVATE)

  // One thread, so an older write can never land after a newer one.
  private val worker = Executors.newSingleThreadExecutor()

  private fun inBackground(invoke: Invoke, work: () -> Unit) {
    worker.execute {
      try {
        work()
      } catch (error: Exception) {
        Logger.error("Folder access failed: ${error.message}")
        invoke.reject(error.message ?: "Could not reach the folder.")
      }
    }
  }

  private fun storedFolder(): Uri? = preferences.getString(FOLDER_KEY, null)?.let(Uri::parse)

  private fun requireFolder(): Uri = storedFolder() ?: throw IllegalStateException("No folder connected yet.")

  private fun folderDocument(folder: Uri): Uri =
    DocumentsContract.buildDocumentUriUsingTree(folder, DocumentsContract.getTreeDocumentId(folder))

  private fun displayName(folder: Uri): String? =
    resolver.query(folderDocument(folder), arrayOf(Document.COLUMN_DISPLAY_NAME), null, null, null)
      ?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }

  private fun findChild(folder: Uri, name: String): Uri? {
    val children =
      DocumentsContract.buildChildDocumentsUriUsingTree(folder, DocumentsContract.getTreeDocumentId(folder))
    val columns = arrayOf(Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME)
    resolver.query(children, columns, null, null, null)?.use { cursor ->
      while (cursor.moveToNext()) {
        if (cursor.getString(1) == name) {
          return DocumentsContract.buildDocumentUriUsingTree(folder, cursor.getString(0))
        }
      }
    }
    return null
  }

  private fun supportsRename(document: Uri): Boolean =
    resolver.query(document, arrayOf(Document.COLUMN_FLAGS), null, null, null)?.use { cursor ->
      cursor.moveToFirst() && cursor.getInt(0) and Document.FLAG_SUPPORTS_RENAME != 0
    } ?: false

  private fun readText(document: Uri): String =
    resolver.openInputStream(document)?.use { stream -> stream.readBytes().toString(Charsets.UTF_8) }
      ?: throw IllegalStateException("Could not open $FILE_NAME.")

  private fun writeText(document: Uri, text: String) {
    // "wt" truncates; plain "w" can leave the end of a longer old file behind.
    (resolver.openOutputStream(document, "wt") ?: throw IllegalStateException("Could not open $FILE_NAME."))
      .use { stream -> stream.write(text.toByteArray(Charsets.UTF_8)) }
  }

  private fun createFile(folder: Uri, name: String): Uri =
    DocumentsContract.createDocument(resolver, folderDocument(folder), "application/octet-stream", name)
      ?: throw IllegalStateException("Could not create $name.")

  // A provider may refuse by returning false or null instead of throwing, and
  // reporting that as saved would silently lose the user's edit.
  private fun delete(document: Uri) {
    if (!DocumentsContract.deleteDocument(resolver, document)) {
      throw IllegalStateException("Could not replace the old file in the folder.")
    }
  }

  private fun rename(document: Uri, name: String) {
    DocumentsContract.renameDocument(resolver, document, name)
      ?: throw IllegalStateException("Could not rename the new file in the folder.")
  }

  private fun isJson(text: String): Boolean =
    try {
      JSONObject(text)
      true
    } catch (error: JSONException) {
      Logger.error("Ignoring an unfinished $PARTIAL_NAME: ${error.message}")
      false
    }

  @Command
  fun pick(invoke: Invoke) {
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
      .addFlags(READ_WRITE or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
    val opened = MainActivity.launchPicker(intent) { result -> folderPicked(invoke, result) }
    if (!opened) {
      invoke.reject("The app isn't ready. Try again.")
    }
  }

  private fun folderPicked(invoke: Invoke, result: ActivityResult) {
    val folder = result.data?.data
    if (result.resultCode != Activity.RESULT_OK || folder == null) {
      invoke.resolve(JSObject())
      return
    }
    inBackground(invoke) {
      resolver.takePersistableUriPermission(folder, READ_WRITE)
      val previous = storedFolder()
      if (previous != null && previous != folder) {
        resolver.releasePersistableUriPermission(previous, READ_WRITE)
      }
      preferences.edit().putString(FOLDER_KEY, folder.toString()).apply()
      invoke.resolve(JSObject().put("name", displayName(folder)))
    }
  }

  @Command
  fun restore(invoke: Invoke) {
    inBackground(invoke) {
      val folder = storedFolder()
      val held = resolver.persistedUriPermissions.any { it.uri == folder && it.isWritePermission }
      val name =
        if (folder == null || !held) {
          null
        } else {
          try {
            displayName(folder)
          } catch (error: Exception) {
            Logger.error("The chosen folder is gone: ${error.message}")
            null
          }
        }
      invoke.resolve(if (name == null) JSObject() else JSObject().put("name", name))
    }
  }

  @Command
  fun read(invoke: Invoke) {
    inBackground(invoke) {
      val folder = requireFolder()
      val file = findChild(folder, FILE_NAME)
      if (file != null) {
        invoke.resolve(JSObject().put("text", readText(file)))
        return@inBackground
      }
      // A crash between steps of the write below leaves only the finished copy.
      val partial = findChild(folder, PARTIAL_NAME)
      val text = partial?.let(::readText)
      if (partial != null && text != null && isJson(text)) {
        rename(partial, FILE_NAME)
        invoke.resolve(JSObject().put("text", text))
      } else {
        invoke.resolve(JSObject())
      }
    }
  }

  @Command
  fun write(invoke: Invoke) {
    val args = invoke.parseArgs(WriteArgs::class.java)
    inBackground(invoke) {
      val folder = requireFolder()
      findChild(folder, PARTIAL_NAME)?.let(::delete)

      // Written aside first, so a failed write can never leave a truncated
      // portfolio behind. Renaming onto an existing name isn't reliable across
      // document providers, so the old file goes first.
      val partial = createFile(folder, PARTIAL_NAME)
      try {
        writeText(partial, args.text)
      } catch (error: Exception) {
        DocumentsContract.deleteDocument(resolver, partial)
        throw error
      }

      val existing = findChild(folder, FILE_NAME)
      if (supportsRename(partial)) {
        existing?.let(::delete)
        rename(partial, FILE_NAME)
      } else {
        writeText(existing ?: createFile(folder, FILE_NAME), args.text)
        delete(partial)
      }
      invoke.resolve()
    }
  }
}
