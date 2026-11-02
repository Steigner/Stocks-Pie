//! Shell for Stocks Pie.
//!
//! The web app runs unchanged inside the system webview. The only thing added
//! here is storage: the user picks a folder in the operating system's own picker,
//! and four commands read and write `portfolio.json` in it. The page never sees or
//! passes a path, so even compromised page code could not touch any other file.
//! How that works differs enough per platform to give each its own module.

#[cfg(desktop)]
mod desktop;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = desktop::attach(builder);
    builder
        .run(tauri::generate_context!())
        .expect("error while running Stocks Pie");
}
