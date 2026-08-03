#!/usr/bin/env bash
#
# Deploy the Microsoft Copilot Quiz to GitHub Pages.
#
# Prereqs on YOUR machine:
#   - git and the GitHub CLI (`gh`) installed and authenticated (`gh auth status`)
#   - Run this script from the root of the extracted project (where index.html lives)
#
# What it does:
#   1. Ensures the repo exists (creates it public if not) and pushes to `main`, root folder
#   2. Enables GitHub Pages from the `main` branch / root
#   3. Prints the live URL
#
set -euo pipefail

OWNER="$(gh api user --jq .login)"
REPO="copilot-quiz"
SLUG="${OWNER}/${REPO}"

echo "==> Account: ${OWNER}"

# --- 1. Ensure git repo + remote, commit, push to main ---
if [ ! -d .git ]; then
  git init -q
fi

git add -A
git commit -q -m "Add Microsoft Copilot quiz static web app" || echo "   (nothing new to commit)"
git branch -M main

if gh repo view "${SLUG}" >/dev/null 2>&1; then
  echo "==> Repo ${SLUG} already exists"
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/${SLUG}.git"
  git push -u origin main
else
  echo "==> Creating public repo ${SLUG}"
  gh repo create "${REPO}" --public --source=. --push
fi

# --- 2. Enable GitHub Pages from main / root ---
echo "==> Enabling GitHub Pages (branch: main, path: /)"
if gh api "repos/${SLUG}/pages" >/dev/null 2>&1; then
  # Pages already configured -> update the source
  gh api -X PUT "repos/${SLUG}/pages" \
    -F 'source[branch]=main' -F 'source[path]=/' >/dev/null
  echo "   (updated existing Pages configuration)"
else
  gh api -X POST "repos/${SLUG}/pages" \
    -F 'source[branch]=main' -F 'source[path]=/' >/dev/null
  echo "   (created Pages site)"
fi

# --- 3. Print the live URL ---
URL="$(gh api "repos/${SLUG}/pages" --jq .html_url 2>/dev/null || echo "https://${OWNER}.github.io/${REPO}/")"
echo
echo "======================================================================"
echo " Live site (allow ~1 minute for the first build):"
echo "   ${URL}"
echo " Per-module direct links are listed in quiz-links.txt"
echo "======================================================================"
