package com.github.steigner.stockspie

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.ActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  // Tauri's own startActivityForResult stays tied to the first activity, and stops
  // working once Android recreates it. This one is registered by every activity.
  private val documentPicker =
    registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
      pickerResult?.invoke(result)
      pickerResult = null
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    current = this
    // Android draws the app under the system bars and leaves it full height under
    // the keyboard. Padding the webview's parent keeps the page clear of all three.
    ViewCompat.setOnApplyWindowInsetsListener(findViewById<View>(android.R.id.content)) { view, insets ->
      val taken = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or
          WindowInsetsCompat.Type.displayCutout() or
          WindowInsetsCompat.Type.ime(),
      )
      view.setPadding(taken.left, taken.top, taken.right, taken.bottom)
      WindowInsetsCompat.CONSUMED
    }
  }

  override fun onDestroy() {
    if (current === this) {
      current = null
    }
    super.onDestroy()
  }

  companion object {
    private var current: MainActivity? = null

    // Outlives the activity, as Android may recreate it while the picker is open.
    private var pickerResult: ((ActivityResult) -> Unit)? = null

    /** Opens a system picker; false when no activity is there to open it. */
    fun launchPicker(intent: Intent, onResult: (ActivityResult) -> Unit): Boolean {
      val activity = current ?: return false
      pickerResult = onResult
      activity.documentPicker.launch(intent)
      return true
    }
  }
}
