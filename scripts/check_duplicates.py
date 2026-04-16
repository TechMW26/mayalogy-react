#!/usr/bin/env python3
"""Check scope of duplicate CSS selectors."""
import re

with open('css/maya.css', 'r') as f:
    lines = f.readlines()

def get_scope(lines, target_line):
    depth = 0
    current_media = None
    for i in range(target_line - 1):
        line = lines[i]
        if '@media' in line:
            current_media = f"@media at line {i+1}"
        for ch in line:
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    current_media = None
    if depth == 0:
        return "TOP-LEVEL"
    elif current_media:
        return f"INSIDE {current_media}"
    else:
        return f"NESTED (depth={depth})"

check_lines = [
    6092, 19778, 6214, 19800, 6103, 19785, 6170, 19795, 6133, 19789,
    1334, 19773, 6326, 6411, 19822, 19598, 19836, 472, 13100, 633,
    12883, 166, 7350, 11949, 18397, 11990, 18400, 1017, 12999, 13044,
    12952, 18187, 18385, 163, 175, 2296, 7206, 12889, 2310, 7214,
    1855, 12953, 18188, 18387, 1977, 12921, 1984, 12930, 1923, 2058,
    13952, 15500, 15949, 13811, 15803, 16487, 13945, 15493, 15948,
    14063, 15169, 16117, 17308, 17747, 18064, 18896, 18902,
]

for ln in sorted(check_lines):
    scope = get_scope(lines, ln)
    content = lines[ln-1].strip()[:80]
    print(f"Line {ln:>5}: {scope:<50} | {content}")
