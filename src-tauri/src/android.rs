//! Android: `std::fs` cannot reach a folder the user picked, so these commands go
//! through `FolderPlugin.kt` in gen/android. It holds the folder's address, and no
//! capability grants the page the plugin, so it is reachable only from here.

use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder as PluginBuilder, PluginHandle, TauriPlugin};
use tauri::{Builder, Manager, State, Wry};

struct Folder(PluginHandle<Wry>);

#[derive(Deserialize)]
struct Named {
    name: Option<String>,
}

#[derive(Deserialize)]
struct Contents {
    text: Option<String>,
}

#[derive(Serialize)]
struct WriteArgs {
    text: String,
}

fn plugin() -> TauriPlugin<Wry> {
    PluginBuilder::new("folder")
        .setup(|app, api| {
            let handle =
                api.register_android_plugin("com.github.steigner.stockspie", "FolderPlugin")?;
            app.manage(Folder(handle));
            Ok(())
        })
        .build()
}

// These stay async: a synchronous command runs on the main thread, where Kotlin
// commands run too, so waiting for the plugin there would deadlock.

/// Opens the system folder picker; `None` when the user cancels it.
#[tauri::command]
async fn choose_folder(folder: State<'_, Folder>) -> Result<Option<String>, String> {
    let named: Named = folder.0.run_mobile_plugin("pick", ()).map_err(|error| error.to_string())?;
    Ok(named.name)
}

/// Reconnects to the folder chosen on an earlier launch, if it is still reachable.
#[tauri::command]
async fn restore_folder(folder: State<'_, Folder>) -> Result<Option<String>, String> {
    let named: Named =
        folder.0.run_mobile_plugin("restore", ()).map_err(|error| error.to_string())?;
    Ok(named.name)
}

/// The portfolio file's text, or `None` while the folder has no portfolio yet.
#[tauri::command]
async fn load_portfolio(folder: State<'_, Folder>) -> Result<Option<String>, String> {
    let contents: Contents =
        folder.0.run_mobile_plugin("read", ()).map_err(|error| error.to_string())?;
    Ok(contents.text)
}

#[tauri::command]
async fn save_portfolio(folder: State<'_, Folder>, text: String) -> Result<(), String> {
    folder
        .0
        .run_mobile_plugin::<()>("write", WriteArgs { text })
        .map_err(|error| error.to_string())
}

pub fn attach(builder: Builder<Wry>) -> Builder<Wry> {
    builder.plugin(plugin()).invoke_handler(tauri::generate_handler![
        choose_folder,
        restore_folder,
        load_portfolio,
        save_portfolio
    ])
}
