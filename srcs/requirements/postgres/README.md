
## CHEAT SHEET

A formal reference, organized from the most fundamental (system-level) to the most specific (data-level).

In the world of `psql`, commands starting with `\` are **Meta-commands** (processed by the terminal itself), while those ending in `;` are **Standard SQL** (processed by the database engine).

### 1. Navigation & Discovery
| Action | Meta-command | SQL Alternative |
| :--- | :--- | :--- |
| **List Databases** | `\l` | `SELECT datname FROM pg_database;` |
| **Connect to DB** | `\c <db_name>` | (None—must use a connection library) (No SQL equivalent; this is a session command)|
| **List Tables** | `\dt` | `SELECT * FROM information_schema.tables WHERE table_schema = 'public';` |
| **Describe Table** | `\d <table_name>` | `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '...';` |
| **List Users/Roles**| `\du` | `SELECT usename FROM pg_user;` |

### 2. Data Inspection
| Action | SQL Command | Notes |
| :--- | :--- | :--- |
| **Read All Rows** | `SELECT * FROM <table_name>;` | Use `\x` before this to toggle "Expanded View" (helpful for long rows). |
| **Count Rows** | `SELECT count(*) FROM <table>;` | Essential for verifying if migrations actually ran. |
| **Filter Rows** | `SELECT * FROM <table> WHERE id = '...';` | For UUIDs, ensure you use single quotes `'`. |
| **Limit Results** | `SELECT * FROM <table> LIMIT 5;` | Prevents flooding your terminal window. |

### 3. Environment Control
| Action | Command | Purpose |
| :--- | :--- | :--- |
| **Quit/Exit** | `\q` | Gracefully return to the shell. |
| **Toggle Headers** | `\t` | Hides the "row count" and "column names" for cleaner output. |
| **Watch** | `\watch 2` | Append this after a query to repeat it every 2 seconds (good for monitoring). |
| **Clear Screen** | `\! clear` | Runs the shell `clear` command without leaving `psql`. |

---

### Tip for the SQL User:
If you find yourself lost in a long query output, remember that `psql` uses `less` as its pager.
- **`q`**: Exit the viewer and return to the prompt.
- **`/`**: Search for a string within the results.
- **`Space`**: Page down.
