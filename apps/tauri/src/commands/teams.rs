//! Teams commands (M5.2).
//!
//! Thin pass-throughs to the cloud's `/v1/me/teams` and
//! `/v1/teams/:id/members` endpoints. No local DB — teams live in the
//! cloud only.

use std::sync::Arc;

use mizan_connect::{MyTeamsResponse, TeamMembersResponse};
use tauri::State;

use crate::context::ServiceContext;

/// `list_my_teams() -> MyTeamsResponse`
#[tauri::command]
pub async fn list_my_teams(
    state: State<'_, Arc<ServiceContext>>,
) -> Result<MyTeamsResponse, String> {
    state.connect_service().list_my_teams().await
}

/// `list_team_members(teamId) -> TeamMembersResponse`
#[tauri::command(rename_all = "camelCase")]
pub async fn list_team_members(
    team_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<TeamMembersResponse, String> {
    state.connect_service().list_team_members(&team_id).await
}
