with open("app/(home)/messages.tsx", "r", encoding="utf-8") as f:
    content = f.read()

with open("old.txt", "r", encoding="utf-8") as f:
    old_str = f.read()

with open("new.txt", "r", encoding="utf-8") as f:
    new_str = f.read()

# Replace exactly
new_content = content.replace(old_str, new_str)
if new_content == content:
    print("Replace failed! Could not find old.txt content in messages.tsx")
else:
    with open("app/(home)/messages.tsx", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Replaced successfully!")
