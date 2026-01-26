#!/bin/bash

# This script traverses the srcs directory and outputs the filename followed by its content.
# It ignores node_modules, .git, and other build artifacts.

TARGET_DIR="./srcs"

if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: $TARGET_DIR directory not found."
    exit 1
fi

# Find all files, excluding common dependency and build folders
find "$TARGET_DIR" -type f \
	-not -path "*/frontend_42/*" \
	-not -path "*/.DS_Store" \
    -not -path "*/node_modules/*" \
    -not -path "*/secrets/*" \
    -not -path "*/DOCS/*" \
    -not -path "*/.git/*" \
    -not -path "*/.next/*" \
    -not -path "*/dist/*" \
    -not -path "*/.astro/*" \
    -not -name "*.db" \
    -not -name ".env" \
    -not -name "*.png" \
    -not -name "*.jpg" \
    -not -name "*.ico" | while read -r file; do
    echo "-------------------------------------------------------------------------------"
    echo "FILE: $file"
    echo "-------------------------------------------------------------------------------"
    cat "$file"
    echo -e "\n"
done
