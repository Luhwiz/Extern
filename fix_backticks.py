import re

with open('backend/routes/claude.js', 'r') as f:
    content = f.read()

# I will replace all backticks with escaped backticks inside the AUTOMATED BACKEND block
start_marker = "AUTOMATED BACKEND & NAMESPACING (CRITICAL):"
end_marker = "═══════════════════════════════════════════\nDEFAULT TECH STACK"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    block = content[start_idx:end_idx]
    # Replace all backticks with \` so they don't break the JS template string
    # BUT first I should unescape any already escaped backticks so I don't double escape
    block = block.replace('\\`', '`')
    block = block.replace('`', '\\`')
    # Also I need to escape ${}
    block = block.replace('${', '\\${')
    
    content = content[:start_idx] + block + content[end_idx:]
    
    with open('backend/routes/claude.js', 'w') as f:
        f.write(content)
    print("Fixed backticks")
else:
    print("Markers not found")
