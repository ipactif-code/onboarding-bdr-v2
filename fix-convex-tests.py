#!/usr/bin/env python3
"""
Fix convex-test authentication pattern in test files.
"""

import re

def fix_test_file(filename):
    """Fix authentication pattern in a test file."""
    print(f"Processing {filename}...")

    with open(filename, 'r') as f:
        lines = f.readlines()

    # Find all problematic query/mutation calls
    issues = []
    for i, line in enumerate(lines):
        # Look for await t.query( or await t.mutation(
        if re.search(r'await\s+t\.(query|mutation)\(api\.', line):
            issues.append((i + 1, line.strip()))

    if issues:
        print(f"  Found {len(issues)} problematic calls:")
        for line_num, line_content in issues[:15]:
            print(f"    Line {line_num}: {line_content[:100]}")
        if len(issues) > 15:
            print(f"    ... and {len(issues) - 15} more")
    else:
        print("  ✓ No issues found!")

    return len(issues)

if __name__ == "__main__":
    files = [
        "tests/unit/convex/messages.test.ts",
        "tests/unit/convex/channels.test.ts"
    ]

    total_issues = 0
    for f in files:
        try:
            issues = fix_test_file(f)
            total_issues += issues
        except FileNotFoundError:
            print(f"  ✗ File not found: {f}")

    print(f"\nTotal issues: {total_issues}")
