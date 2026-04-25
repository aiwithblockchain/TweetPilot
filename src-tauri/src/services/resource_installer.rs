use std::fs;
use std::path::{Path, PathBuf};

const APP_HOME_DIR: &str = ".tweetpilot";
const BUNDLED_HOME_DIR: &str = "tweetpilot-home";
const SKILL_FILE_NAME: &str = "skill.md";
const CLAWBOT_DIR_NAME: &str = "clawbot";

pub fn ensure_bundled_home_installed(resource_dir: &Path) -> Result<(), String> {
    let bundled_home = resolve_bundled_home_dir(resource_dir)?;

    let target_home = tweetpilot_home_dir()?;
    log::info!(
        "[resource_installer] Ensuring bundled home resources in {} from {}",
        target_home.display(),
        bundled_home.display()
    );
    fs::create_dir_all(&target_home)
        .map_err(|e| format!("Failed to create TweetPilot home directory {}: {}", target_home.display(), e))?;

    copy_file_if_missing(
        &bundled_home.join(SKILL_FILE_NAME),
        &target_home.join(SKILL_FILE_NAME),
    )?;
    copy_dir_if_missing(
        &bundled_home.join(CLAWBOT_DIR_NAME),
        &target_home.join(CLAWBOT_DIR_NAME),
    )?;

    log::info!(
        "[resource_installer] Bundled home resources are ready in {}",
        target_home.display()
    );

    Ok(())
}

pub fn tweetpilot_home_dir() -> Result<PathBuf, String> {
    tweetpilot_home_dir_from_env()
}

fn resolve_bundled_home_dir(resource_dir: &Path) -> Result<PathBuf, String> {
    let direct_path = resource_dir.join(BUNDLED_HOME_DIR);
    if direct_path.exists() {
        return Ok(direct_path);
    }

    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..").join("resources").join(BUNDLED_HOME_DIR);
    if dev_path.exists() {
        log::info!(
            "[resource_installer] Using development bundled home resources from {}",
            dev_path.display()
        );
        return Ok(dev_path);
    }

    Err(format!(
        "Bundled TweetPilot home resources not found in {} or {}",
        direct_path.display(),
        dev_path.display()
    ))
}

fn tweetpilot_home_dir_from_env() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "Cannot read HOME directory".to_string())?;
    Ok(PathBuf::from(home).join(APP_HOME_DIR))
}

fn copy_file_if_missing(source: &Path, target: &Path) -> Result<(), String> {
    if target.exists() {
        return Ok(());
    }

    if !source.exists() {
        return Err(format!("Bundled resource file not found: {}", source.display()));
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory {}: {}", parent.display(), e))?;
    }

    fs::copy(source, target).map_err(|e| {
        format!(
            "Failed to copy resource file from {} to {}: {}",
            source.display(),
            target.display(),
            e
        )
    })?;

    Ok(())
}

fn copy_dir_if_missing(source: &Path, target: &Path) -> Result<(), String> {
    if target.exists() {
        return Ok(());
    }

    if !source.exists() {
        return Err(format!("Bundled resource directory not found: {}", source.display()));
    }

    copy_dir_recursive(source, target)
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target)
        .map_err(|e| format!("Failed to create directory {}: {}", target.display(), e))?;

    let entries = fs::read_dir(source)
        .map_err(|e| format!("Failed to read directory {}: {}", source.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let entry_path = entry.path();
        let target_path = target.join(entry.file_name());
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata for {}: {}", entry_path.display(), e))?;

        if metadata.is_dir() {
            copy_dir_recursive(&entry_path, &target_path)?;
        } else {
            fs::copy(&entry_path, &target_path).map_err(|e| {
                format!(
                    "Failed to copy resource file from {} to {}: {}",
                    entry_path.display(),
                    target_path.display(),
                    e
                )
            })?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{ensure_bundled_home_installed, resolve_bundled_home_dir, tweetpilot_home_dir_from_env};
    use crate::services::test_home_guard::home_test_lock;
    use std::fs;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn with_test_home<T>(name: &str, test: impl FnOnce(std::path::PathBuf) -> T) -> T {
        let _guard = home_test_lock().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let temp_root = std::env::temp_dir().join(format!(
            "tweetpilot-resource-installer-{}-{}",
            name,
            Uuid::new_v4()
        ));
        fs::create_dir_all(&temp_root).expect("create temp home");
        let previous_home = std::env::var("HOME").ok();
        std::env::set_var("HOME", &temp_root);

        let result = test(temp_root.clone());

        if let Some(home) = previous_home {
            std::env::set_var("HOME", home);
        } else {
            std::env::remove_var("HOME");
        }

        let _ = fs::remove_dir_all(&temp_root);
        result
    }

    #[test]
    fn installs_skill_and_clawbot_when_missing() {
        with_test_home("install-missing", |_temp_home| {
            let resource_root = std::env::temp_dir().join(format!(
                "tweetpilot-bundled-home-{}",
                Uuid::new_v4()
            ));
            let bundled_home = resource_root.join("tweetpilot-home");
            let clawbot_dir = bundled_home.join("clawbot");
            fs::create_dir_all(&clawbot_dir).expect("create bundled clawbot dir");
            fs::write(bundled_home.join("skill.md"), "skill content").expect("write skill");
            fs::write(clawbot_dir.join("README.md"), "clawbot readme").expect("write clawbot readme");

            ensure_bundled_home_installed(&resource_root).expect("install bundled home");

            let tweetpilot_home = tweetpilot_home_dir_from_env().expect("resolve tweetpilot home");
            assert_eq!(
                fs::read_to_string(tweetpilot_home.join("skill.md")).expect("read installed skill"),
                "skill content"
            );
            assert_eq!(
                fs::read_to_string(tweetpilot_home.join("clawbot").join("README.md"))
                    .expect("read installed clawbot readme"),
                "clawbot readme"
            );

            let _ = fs::remove_dir_all(&resource_root);
        });
    }

    #[test]
    fn resolve_bundled_home_dir_accepts_direct_resource_path() {
        let resource_root = std::env::temp_dir().join(format!(
            "tweetpilot-bundled-home-direct-{}",
            Uuid::new_v4()
        ));
        let bundled_home = resource_root.join("tweetpilot-home");
        fs::create_dir_all(&bundled_home).expect("create bundled home dir");

        let resolved = resolve_bundled_home_dir(&resource_root).expect("resolve direct bundled home");
        assert_eq!(resolved, bundled_home);

        let _ = fs::remove_dir_all(&resource_root);
    }

    #[test]
    fn resolve_bundled_home_dir_accepts_project_root_in_dev() {
        let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let resolved = resolve_bundled_home_dir(&project_root).expect("resolve dev bundled home");
        assert!(resolved.ends_with("resources/tweetpilot-home"));
    }

    #[test]
    fn keeps_existing_user_files() {
        with_test_home("keep-existing", |_temp_home| {
            let resource_root = std::env::temp_dir().join(format!(
                "tweetpilot-bundled-home-{}",
                Uuid::new_v4()
            ));
            let bundled_home = resource_root.join("tweetpilot-home");
            let clawbot_dir = bundled_home.join("clawbot");
            fs::create_dir_all(&clawbot_dir).expect("create bundled clawbot dir");
            fs::write(bundled_home.join("skill.md"), "bundled skill").expect("write bundled skill");
            fs::write(clawbot_dir.join("README.md"), "bundled readme").expect("write bundled clawbot readme");

            let tweetpilot_home = tweetpilot_home_dir_from_env().expect("resolve tweetpilot home");
            fs::create_dir_all(tweetpilot_home.join("clawbot")).expect("create existing clawbot dir");
            fs::write(tweetpilot_home.join("skill.md"), "user skill").expect("write existing skill");
            fs::write(tweetpilot_home.join("clawbot").join("README.md"), "user readme")
                .expect("write existing clawbot readme");

            ensure_bundled_home_installed(&resource_root).expect("install bundled home");

            assert_eq!(
                fs::read_to_string(tweetpilot_home.join("skill.md")).expect("read preserved skill"),
                "user skill"
            );
            assert_eq!(
                fs::read_to_string(tweetpilot_home.join("clawbot").join("README.md"))
                    .expect("read preserved clawbot readme"),
                "user readme"
            );

            let _ = fs::remove_dir_all(&resource_root);
        });
    }
}
