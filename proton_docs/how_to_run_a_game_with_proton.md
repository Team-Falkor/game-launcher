### **The Goal: Run `VampireSurvivors.exe` using `GE-Proton10-9` with an isolated Wine prefix.**

---

### **Step 1: Create Necessary Directories**

```bash
mkdir -p "/home/tommy/Desktop/Games/Vampire Survivors/pfx"
mkdir -p "/home/tommy/.local/share/Steam/steamapps/compatdata"
mkdir -p "/home/tommy/.config/protonfixes"
```

*   **`mkdir -p`**: This command is used to *make directories*. The `-p` flag is crucial because it tells `mkdir` to create any necessary parent directories if they don't already exist. For example, if `/home/tommy/Desktop/Games/Vampire Survivors/` didn't exist, it would create that first before creating `pfx`.

    *   **`/home/tommy/Desktop/Games/Vampire Survivors/pfx`**:
        *   **Purpose:** This is the **Wine prefix** (often called a "Wine Bottle" or "compatibility data"). It's a self-contained virtual Windows environment where Proton installs all the necessary Windows files, registry entries, and configurations specific to **Vampire Survivors**. Keeping games in separate prefixes helps avoid conflicts between different games or applications.
        *   **Why it's here:** This path is explicitly specified by the `WINEPREFIX` environment variable in the final run command. Proton needs this directory to exist so it can create and store the game's prefix files within it.

    *   **`/home/tommy/.local/share/Steam/steamapps/compatdata`**:
        *   **Purpose:** This directory is Steam's default location for *all* game compatibility data (Wine prefixes and other Proton-related files) when games are managed by Steam. Even though you're running a non-Steam game, Proton (especially GE-Proton versions) often tries to create internal lock files (like `pfx.lock`) or reference this path during its initialization.
        *   **Why it's here:** Our troubleshooting revealed a `FileNotFoundError` related to `pfx.lock` within this path. By ensuring this directory exists, we resolve that specific issue, allowing Proton to manage its internal session and locking mechanisms without failing.

    *   **`/home/tommy/.config/protonfixes`**:
        *   **Purpose:** ProtonFixes is a component within Proton that applies game-specific workarounds or tweaks to make certain games run better (or at all). This directory is where ProtonFixes expects to find or create its configuration files (like `config.ini`).
        *   **Why it's here:** We encountered a `WARN: [CONFIG]: Parent directory "/home/tommy/.config/protonfixes" does not exist. Abort.` This means ProtonFixes needed this directory to exist to initialize properly. Creating it beforehand prevents this warning and ensures all Proton components can start correctly.

---

### **Step 2: Export Environment Variables**

```bash
export STEAM_COMPAT_DATA_PATH="/home/tommy/.local/share/Steam/steamapps/compatdata"
export STEAM_COMPAT_CLIENT_INSTALL_PATH="/home/tommy/.local/share/Steam"
```

*   **`export`**: This command makes the following variable available to any child processes launched from the current terminal session. Environment variables are how programs communicate configuration information.
*   **`STEAM_COMPAT_DATA_PATH="/home/tommy/.local/share/Steam/steamapps/compatdata"`**:
    *   **Purpose:** This environment variable explicitly tells Proton *where Steam would normally store its compatibility data*. Even though your game's specific prefix is set by `WINEPREFIX`, Proton's internal Python scripts (part of the GE-Proton package) rely on this variable being set for various internal operations, such as handling temporary files and the aforementioned `pfx.lock`.
    *   **Why it's needed:** Without this, you encountered a `FileNotFoundError` for `/home/tommy/.local/share/Steam/steamapps/compatdata/pfx.lock`, as Proton couldn't find the base directory to put its lock file.

*   **`STEAM_COMPAT_CLIENT_INSTALL_PATH="/home/tommy/.local/share/Steam"`**:
    *   **Purpose:** This environment variable points to the main Steam client installation directory. Proton, being a Steam product, needs to know where the Steam client's core files and libraries are located for its own internal initialization processes.
    *   **Why it's needed:** We encountered a `KeyError: 'STEAM_COMPAT_CLIENT_INSTALL_PATH'` because Proton's script was trying to read this variable, and it simply wasn't set in the environment. Setting it resolves this Python error within Proton's startup logic.

*   **Crucial Point: "Must be in the same terminal session"**:
    The `export` command only applies to the current shell session. If you close the terminal or open a new one, these variables will be unset. Therefore, you must run the `export` commands and the final Proton run command sequentially within the *same* open terminal window.

---

### **Step 3: Run the Game with Proton**

```bash
WINEPREFIX="/home/tommy/Desktop/Games/Vampire Survivors/pfx" /home/tommy/.local/share/Steam/compatibilitytools.d/GE-Proton10-9/proton run "/home/tommy/Desktop/Games/Vampire Survivors/VampireSurvivors.exe"
```

*   **`WINEPREFIX="/home/tommy/Desktop/Games/Vampire Survivors/pfx"`**:
    *   **Purpose:** This part sets the `WINEPREFIX` environment variable *specifically for this single command*. It overrides any default Wine prefix location and tells Proton/Wine to use or create the Wine prefix at `/home/tommy/Desktop/Games/Vampire Survivors/pfx`. This ensures your game's Windows environment is isolated and located where you expect.
    *   **Note:** This is different from the `export` command because it sets the variable only for the duration of this one command, not for the entire terminal session (though it achieves the same effect here since the command is self-contained).

*   **`/home/tommy/.local/share/Steam/compatibilitytools.d/GE-Proton10-9/proton`**:
    *   **Purpose:** This is the absolute path to the specific GE-Proton executable you want to use. This is the main "program" that will manage the Wine environment and launch your game.

*   **`run`**:
    *   **Purpose:** This is a subcommand recognized by the Proton executable. It tells Proton to take the following path and execute it as a Windows application within the specified Wine prefix.

*   **`"/home/tommy/Desktop/Games/Vampire Survivors/VampireSurvivors.exe"`**:
    *   **Purpose:** This is the absolute path to your game's actual Windows executable. This is the program that Proton will run. The quotes are important in case there are spaces in the path (though not strictly necessary here).

*   **Why no `sudo`?**:
    As discussed, running graphical applications or Proton with `sudo` is highly discouraged. It leads to file ownership issues (`root` owning game files, preventing your user from accessing them) and potential display environment problems. All the errors we encountered were due to missing directories or unset environment variables, not insufficient user permissions to *create* or *write to* existing, correctly-permissioned locations.

By following these steps, you're manually replicating the environment and conditions that Steam would typically set up for its games, allowing Proton to function correctly with your non-Steam title.
