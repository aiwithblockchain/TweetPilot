use std::fs;
use std::path::{Path, PathBuf};

const APP_HOME_DIR: &str = ".tweetpilot";
const SKILL_FILE_NAME: &str = "skill.md";

#[derive(Debug)]
pub struct SessionConstraints {
    sections: Vec<String>,
    included_sources: Vec<String>,
}

impl SessionConstraints {
    pub fn into_system_prompt(self) -> String {
        self.sections
            .into_iter()
            .filter(|section| !section.trim().is_empty())
            .collect::<Vec<_>>()
            .join("\n\n")
    }

    pub fn included_sources(&self) -> &[String] {
        &self.included_sources
    }
}

pub fn build_session_constraints(_working_dir: &Path, _user_message: Option<&str>) -> Result<SessionConstraints, String> {
    let tweetpilot_home = tweetpilot_home_dir()?;
    let skill_path = tweetpilot_home.join(SKILL_FILE_NAME);
    let skill_content = read_required_file(
        &skill_path,
        "全局约束文档 skill.md 缺失",
    )?;

    Ok(SessionConstraints {
        sections: vec![skill_content],
        included_sources: vec![skill_path.display().to_string()],
    })
}

fn read_required_file(path: &Path, missing_message: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            missing_message.to_string()
        } else {
            format!("读取文件失败 {}: {}", path.display(), error)
        }
    })
}

fn tweetpilot_home_dir() -> Result<PathBuf, String> {
    tweetpilot_home_dir_from_env()
}

fn tweetpilot_home_dir_from_env() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "无法读取 HOME 目录".to_string())?;
    Ok(PathBuf::from(home).join(APP_HOME_DIR))
}

#[cfg(test)]
mod tests {
    use super::build_session_constraints;
    use crate::services::test_home_guard::home_test_lock;
    use std::fs;
    use uuid::Uuid;

    fn with_test_home_and_workspace<T>(
        name: &str,
        test: impl FnOnce(std::path::PathBuf, std::path::PathBuf) -> T,
    ) -> T {
        let _guard = home_test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let temp_root = std::env::temp_dir().join(format!(
            "tweetpilot-session-constraints-{}-{}",
            name,
            Uuid::new_v4()
        ));
        let home_dir = temp_root.join("home");
        let workspace_dir = temp_root.join("workspace");
        fs::create_dir_all(&home_dir).expect("create temp home");
        fs::create_dir_all(&workspace_dir).expect("create workspace");

        let previous_home = std::env::var("HOME").ok();
        std::env::set_var("HOME", &home_dir);

        let result = test(home_dir.clone(), workspace_dir.clone());

        if let Some(home) = previous_home {
            std::env::set_var("HOME", home);
        } else {
            std::env::remove_var("HOME");
        }

        let _ = fs::remove_dir_all(&temp_root);
        result
    }

    #[test]
    fn includes_only_skill_doc_in_system_prompt() {
        with_test_home_and_workspace("include-skill", |home_dir, workspace_dir| {
            let tweetpilot_home = home_dir.join(".tweetpilot");
            fs::create_dir_all(&tweetpilot_home).expect("create tweetpilot home dir");
            fs::write(tweetpilot_home.join("skill.md"), "global skill").expect("write skill");

            let constraints = build_session_constraints(
                &workspace_dir,
                Some("请写一个 Python 脚本，并介绍这个产品的功能"),
            )
            .expect("build constraints");

            assert_eq!(constraints.included_sources().len(), 1);
            assert!(constraints.included_sources()[0].ends_with(".tweetpilot/skill.md"));
            assert_eq!(constraints.into_system_prompt(), "global skill");
        });
    }

    #[test]
    fn returns_missing_message_when_skill_doc_is_absent() {
        with_test_home_and_workspace("missing-skill", |_home_dir, workspace_dir| {
            let error = build_session_constraints(&workspace_dir, Some("帮我生成一条发推文案"))
                .expect_err("missing skill doc should fail");

            assert_eq!(error, "全局约束文档 skill.md 缺失");
        });
    }
}
