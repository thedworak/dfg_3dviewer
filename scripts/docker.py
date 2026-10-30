#!/usr/bin/env python3
"""Helper for the standalone Docker setup (see "Standalone Docker setup" in
README.md).

  scripts/docker.py build   [dev|test|sandbox]   build image(s)
  scripts/docker.py down    [dev|test|sandbox]   stop + remove container(s)
  scripts/docker.py rebuild [dev|test|sandbox]   down, then build
  scripts/docker.py base                         rebuild the worker base image from
                                                 scratch (Blender etc., worker/Dockerfile.base)
  scripts/docker.py prune                        docker system prune (asks first)
  scripts/docker.py env                          (re)configure .env interactively
  scripts/docker.py                              interactive menu

Add --up to build/rebuild to start the result afterwards (docker compose up -d).
Every step reports success, and build/rebuild end with the localhost URLs
the services are (or will be) available on.

The profile selects the viewer-<profile> service and is passed to
docker-compose.yml as VIEWER_PROFILE (build arg, see docker/profiles/), so
docker-compose.yml itself is never edited. Without a profile, build/down
act on every service (including the shared worker).

build/rebuild/base first check .env: when it is missing it is created from
.env.example and the "must set before publishing" values are asked for
(Enter keeps the shown default); when it exists, empty required values are
reported and can be filled in. Without a terminal it only copies and warns.
"""

from __future__ import annotations

import getpass
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

PROFILES = ("dev", "test", "sandbox")
ACTIONS = ("build", "down", "rebuild", "prune", "base", "env")
ENV_FILE = Path(".env")
ENV_EXAMPLE = Path(".env.example")

# service -> default published host port (see docker-compose.yml)
SERVICE_DEFAULTS = {"viewer-test": "3000", "viewer-dev": "3001", "viewer-sandbox": "3002", "worker": "8080"}


def usage() -> None:
    print(__doc__.strip())


def ok(message: str) -> None:
    print(f"\033[32m✔ {message}\033[0m")


def info(message: str) -> None:
    print(f">> {message}")


def warn(message: str) -> None:
    print(f"\033[33m! {message}\033[0m", file=sys.stderr)


def compose(*args: str, profile: str = "", capture: bool = False) -> subprocess.CompletedProcess:
    env = {**os.environ, "VIEWER_PROFILE": profile} if profile else None
    if capture:
        return subprocess.run(["docker", "compose", *args], env=env, capture_output=True, text=True)
    return subprocess.run(["docker", "compose", *args], env=env, check=True)


def interactive() -> bool:
    return sys.stdin.isatty() and os.access("/dev/tty", os.R_OK)


def ask_yes(question: str, default: str) -> bool:
    answer = input(f"{question} ") or default
    return answer[:1] in ("Y", "y", "T", "t")


def get_env_value(key: str) -> str:
    values = [line[len(key) + 1:] for line in ENV_FILE.read_text().splitlines() if line.startswith(f"{key}=")]
    return values[-1] if values else ""


def set_env_value(key: str, value: str) -> None:
    """Sets KEY=value in .env (replacing the first KEY= line and dropping
    later duplicates, or appending)."""
    lines, done = [], False
    for line in ENV_FILE.read_text().splitlines():
        if line.startswith(f"{key}="):
            if not done:
                lines.append(f"{key}={value}")
            done = True
        else:
            lines.append(line)
    if not done:
        lines.append(f"{key}={value}")
    ENV_FILE.write_text("\n".join(lines) + "\n")


def env_section_keys(want: str) -> list:
    """Keys of a .env.example section: required ("Server - must set before
    publishing") or optional ("Server - optional")."""
    section, keys = None, []
    for line in ENV_EXAMPLE.read_text().splitlines():
        if line.startswith("# Server - must set"):
            section = "required"
        elif line.startswith("# Server - optional"):
            section = "optional"
        elif section == want and re.match(r"[A-Z_][A-Z0-9_]*=", line):
            keys.append(line.split("=", 1)[0])
    return keys


def env_key_help(key: str) -> str:
    """Comment lines directly above KEY in .env.example, shown as the prompt help."""
    buf = ""
    for line in ENV_EXAMPLE.read_text().splitlines():
        if line.startswith("#") and not line.startswith("# ===="):
            buf += f"   {line[2:]}\n"
        elif line.startswith(f"{key}="):
            return buf
        else:
            buf = ""
    return ""


def prompt_env(section: str, only_empty: bool = False) -> None:
    for key in env_section_keys(section):
        current = get_env_value(key)
        if only_empty and current:
            continue
        print()
        print(env_key_help(key), end="")
        if re.search("PASSWORD|SECRET", key):
            shown = "set, Enter keeps it" if current else "empty"
            value = getpass.getpass(f"  {key} [{shown}]: ")
        else:
            value = input(f"  {key} [{current}]: ")
        set_env_value(key, value or current)


def configure_env() -> None:
    info("Required settings (Enter keeps the value in brackets)")
    prompt_env("required")
    if ask_yes("Configure optional server settings too? [y/N]", "n"):
        prompt_env("optional")
    ok(f"{ENV_FILE} saved")


def check_env() -> None:
    if not ENV_FILE.is_file():
        if not ENV_EXAMPLE.is_file():
            warn(f"{ENV_EXAMPLE} not found, skipping .env check")
            return
        shutil.copyfile(ENV_EXAMPLE, ENV_FILE)
        info(f"{ENV_FILE} not found, created from {ENV_EXAMPLE}")
        if interactive():
            configure_env()
        else:
            warn(f"No terminal - edit {ENV_FILE} and set the required values before publishing")
        return
    missing = [key for key in env_section_keys("required") if not get_env_value(key)]
    if not missing:
        ok(f"{ENV_FILE} found, required values set")
        return
    warn(f"{ENV_FILE}: required values empty: {' '.join(missing)}")
    if interactive() and ask_yes("Fill them in now? [y/N]", "n"):
        prompt_env("required", only_empty=True)
        ok(f"{ENV_FILE} saved")


def service_port(svc: str) -> str:
    """Host port a service is published on: asks Compose when it is running (so
    docker-compose.override.yml port remaps are respected), otherwise falls
    back to the defaults from docker-compose.yml."""
    container_port = "8080" if svc == "worker" else "3000"
    result = compose("port", svc, container_port, capture=True)
    first = result.stdout.splitlines()[0] if result.returncode == 0 and result.stdout.strip() else ""
    return first.rpartition(":")[2] or SERVICE_DEFAULTS[svc]


def print_availability(state: str, profile: str = "") -> None:
    services = [f"viewer-{profile}"] if profile else list(SERVICE_DEFAULTS)
    if state == "running":
        info("Available on:")
    else:
        info("Built, not started yet (re-run with --up, or 'docker compose up -d'). Once started, available on:")
    for svc in services:
        print(f"   {svc:<15} http://localhost:{service_port(svc)}")


def do_build(profile: str = "") -> None:
    if profile:
        info(f"building viewer-{profile} (VIEWER_PROFILE={profile})")
        compose("build", f"viewer-{profile}", profile=profile)
        ok(f"Image for viewer-{profile} built (profile: {profile})")
    else:
        info("building all services")
        compose("build")
        ok("All images built")


def do_down(profile: str = "") -> None:
    if profile:
        info(f"removing viewer-{profile}")
        compose("stop", f"viewer-{profile}")
        compose("rm", "-f", f"viewer-{profile}")
        ok(f"viewer-{profile} stopped and container removed")
    else:
        info("docker compose down")
        compose("down")
        ok("All containers and networks removed (volumes kept)")


def do_up(profile: str = "") -> None:
    if profile:
        compose("up", "-d", f"viewer-{profile}", profile=profile)
        ok(f"viewer-{profile} started")
    else:
        compose("up", "-d")
        ok("All services started")


def do_prune() -> int:
    # Without -f docker prompts for confirmation itself.
    if subprocess.run(["docker", "system", "prune"]).returncode == 0:
        ok("docker system prune finished")
        return 0
    print("docker system prune did not complete (cancelled or failed)", file=sys.stderr)
    return 1


def run(action: str, profile: str = "", up: bool = False) -> int:
    if action in ("build", "rebuild", "base"):
        check_env()
    if action == "env":
        if not interactive():
            warn("env needs a terminal")
            return 1
        if not ENV_FILE.is_file():
            shutil.copyfile(ENV_EXAMPLE, ENV_FILE)
        configure_env()
        return 0
    if action == "prune":
        return do_prune()
    if action == "base":
        compose("build", "--no-cache", "--pull", "worker-base")
        ok("Worker base image rebuilt")
        return 0
    if action == "build":
        do_build(profile)
    elif action == "down":
        do_down(profile)
        return 0
    elif action == "rebuild":
        do_down(profile)
        do_build(profile)
    else:
        usage()
        return 1
    if up:
        do_up(profile)
        print_availability("running", profile)
    else:
        print_availability("built", profile)
    return 0


def menu() -> int:
    print("1) build")
    print("2) build + up")
    print("3) down")
    print("4) down + build")
    print("5) system prune")
    print("6) configure .env")
    choice = input("Choice [1-6]: ")
    choices = {"1": ("build", False), "2": ("build", True), "3": ("down", False), "4": ("rebuild", False)}
    if choice == "5":
        return do_prune()
    if choice == "6":
        return run("env")
    if choice not in choices:
        print("Invalid choice", file=sys.stderr)
        return 1
    action, up = choices[choice]
    profile = input(f"Profile ({' '.join(PROFILES)}, empty = all): ")
    if profile and profile not in PROFILES:
        print(f"Unknown profile: {profile}", file=sys.stderr)
        return 1
    return run(action, profile, up)


def main(argv: list) -> int:
    os.chdir(Path(__file__).resolve().parent.parent)
    if not argv:
        return menu()
    action, profile, up = "", "", False
    for arg in argv:
        if arg in ("-h", "--help", "help"):
            usage()
            return 0
        if arg == "--up":
            up = True
        elif arg in ACTIONS:
            action = arg
        elif arg in PROFILES:
            profile = arg
        else:
            print(f"Unknown argument: {arg}", file=sys.stderr)
            usage()
            return 1
    if not action:
        usage()
        return 1
    return run(action, profile, up)


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except subprocess.CalledProcessError as e:
        sys.exit(e.returncode)
    except (KeyboardInterrupt, EOFError):
        print()
        sys.exit(130)
