//! Desktop shell for Stocks Pie.
//!
//! The web app runs unchanged inside the system webview. Besides fitting the
//! window to the screen, the only thing added here is storage: the user picks a
//! folder in the operating system's dialog, and these commands read and write
//! `portfolio.json` in it. The page never sees or passes a path, so even
//! compromised page code could not touch any other file.

// Keeps a Windows release build from opening a console window next to the app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, LogicalSize, Manager, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

const FILE_NAME: &str = "portfolio.json";
/// Remembers the chosen folder between launches. It holds a path, never portfolio data.
const FOLDER_RECORD: &str = "folder.txt";

#[derive(Default)]
struct Folder(Mutex<Option<PathBuf>>);

fn folder_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.display().to_string())
}

fn folder_record(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_config_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join(FOLDER_RECORD))
}

fn portfolio_file(folder: &Folder) -> Result<PathBuf, String> {
    let chosen = folder.0.lock().map_err(|error| error.to_string())?.clone();
    chosen
        .map(|directory| directory.join(FILE_NAME))
        .ok_or_else(|| "No folder connected yet.".to_string())
}

fn remember(folder: &Folder, path: PathBuf) -> Result<String, String> {
    let name = folder_name(&path);
    *folder.0.lock().map_err(|error| error.to_string())? = Some(path);
    Ok(name)
}

/// Opens the system folder dialog; `None` when the user cancels it.
#[tauri::command]
async fn choose_folder(app: AppHandle, folder: State<'_, Folder>) -> Result<Option<String>, String> {
    let Some(picked) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(|error| error.to_string())?;
    fs::write(folder_record(&app)?, path.to_string_lossy().as_bytes())
        .map_err(|error| error.to_string())?;
    remember(&folder, path).map(Some)
}

/// Reconnects to the folder chosen on an earlier launch, if it still exists.
#[tauri::command]
fn restore_folder(app: AppHandle, folder: State<'_, Folder>) -> Result<Option<String>, String> {
    let Ok(recorded) = fs::read_to_string(folder_record(&app)?) else {
        return Ok(None);
    };
    let path = PathBuf::from(recorded.trim());
    if !path.is_dir() {
        return Ok(None);
    }
    remember(&folder, path).map(Some)
}

/// The portfolio file's text, or `None` while the folder has no portfolio yet.
#[tauri::command]
fn load_portfolio(folder: State<'_, Folder>) -> Result<Option<String>, String> {
    match fs::read_to_string(portfolio_file(&folder)?) {
        Ok(text) => Ok(Some(text)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn save_portfolio(folder: State<'_, Folder>, text: String) -> Result<(), String> {
    let target = portfolio_file(&folder)?;
    // Written aside and renamed over the old file, so a failed write can never
    // leave a truncated portfolio behind.
    let partial = target.with_extension("json.partial");
    fs::write(&partial, text).map_err(|error| error.to_string())?;
    fs::rename(&partial, &target).map_err(|error| error.to_string())
}

/// Shrinks the window to fit the screen it opens on, then centres it. The
/// configured size is in logical pixels, so on a small laptop with display
/// scaling at 150% it would otherwise open taller than the screen.
fn fit_to_screen(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };
    let scale = monitor.scale_factor();
    let screen: LogicalSize<f64> = monitor.size().to_logical(scale);
    let size: LogicalSize<f64> = window.outer_size()?.to_logical(scale);
    let width = size.width.min(screen.width * 0.9);
    let height = size.height.min(screen.height * 0.85);
    if width < size.width || height < size.height {
        window.set_size(LogicalSize::new(width, height))?;
    }
    window.center()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Folder::default())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("tauri.conf.json defines the main window");
            // The window starts hidden, so it only appears once it fits the screen.
            if let Err(error) = fit_to_screen(&window) {
                eprintln!("could not fit the window to the screen: {error}");
            }
            window.show()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            choose_folder,
            restore_folder,
            load_portfolio,
            save_portfolio
        ])
        .run(tauri::generate_context!())
        .expect("error while running Stocks Pie");
}
