#!/bin/sh
# Installs the contract libraries at pinned tags and commits (lib/ is git-ignored,
# so every checkout and worktree runs this before `forge build`).
set -eu
cd "$(dirname "$0")"
mkdir -p lib

install_lib() { # <github repo> <tag> <expected commit prefix> <dir>
  if [ -d "lib/$4" ]; then
    echo "lib/$4 present"
    return
  fi
  git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$2" "https://github.com/$1.git" "lib/$4"
  actual=$(git -C "lib/$4" rev-parse HEAD)
  case "$actual" in
    "$3"*) ;;
    *) echo "lib/$4: $2 is $actual, expected $3" >&2; rm -rf "lib/$4"; exit 1 ;;
  esac
  rm -rf "lib/$4/.git"
  echo "lib/$4 $2 ($3)"
}

install_lib foundry-rs/forge-std v1.9.7 77041d2 forge-std
