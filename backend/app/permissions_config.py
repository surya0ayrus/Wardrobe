"""
The full list of permissions, in one place: "{action}_{resource}"  e.g. view_user, update_role.
view_* opens both the list and a record.

Used by the seeder (creates them) and by the Roles screen (permission matrix).
Roles themselves are created in the UI. To add a module: add its resource here,
add it to a group, run `python -m app.seed permissions`.
"""

CRUD = ["view", "create", "update", "delete"]

# Columns of the Roles matrix, in order.
ACTIONS = CRUD

# Headings in the Roles screen, in menu order: group => resources.
GROUPS = {
    "Organization": ["company"],
    "User management": ["user", "role", "activity_log"],
}

# resource => label, actions
RESOURCES = {
    "company": {"label": "Companies", "actions": CRUD},
    "user": {"label": "Users", "actions": ["view", "create", "update"]},
    "role": {"label": "Roles", "actions": CRUD},
    "activity_log": {"label": "Activity Logs", "actions": ["view"]},
}


def all_permission_names() -> list[str]:
    return [f"{action}_{res}" for res, item in RESOURCES.items() for action in item["actions"]]
