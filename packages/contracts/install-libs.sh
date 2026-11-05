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

install_commit() { # <github repo> <full commit> <dir>  (for a repo whose tag is not a usable name)
  if [ -d "lib/$3" ]; then
    echo "lib/$3 present"
    return
  fi
  git init --quiet "lib/$3"
  git -C "lib/$3" fetch --quiet --depth 1 "https://github.com/$1.git" "$2"
  git -C "lib/$3" -c advice.detachedHead=false checkout --quiet FETCH_HEAD
  actual=$(git -C "lib/$3" rev-parse HEAD)
  if [ "$actual" != "$2" ]; then
    echo "lib/$3: fetched $actual, expected $2" >&2; rm -rf "lib/$3"; exit 1
  fi
  rm -rf "lib/$3/.git"
  echo "lib/$3 ($2)"
}

install_lib foundry-rs/forge-std v1.9.7 77041d2 forge-std
install_lib OpenZeppelin/openzeppelin-contracts v5.7.0 cab19933c33c openzeppelin-contracts
# Permit2's only tag is named after its deployed address; this is the commit it points to
# (the verified source of the canonical Permit2, planning/FACTS.md §5). Interfaces only.
install_commit Uniswap/permit2 cc306b601f172c51bc04334a109e98340456620b permit2
