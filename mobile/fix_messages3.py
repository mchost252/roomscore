with open("app/(home)/messages.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("""      {/* ── Scrollable content (starts below absolute header) ── */}
      <Animated.ScrollView
        onScroll={onScroll}
      <AnimatedFlatList""", """      {/* ── Scrollable content (starts below absolute header) ── */}
      <AnimatedFlatList""")

content = content.replace("/>      {/* ── AddFriendModal Bottom Sheet ── */}", "/>\n\n      {/* ── AddFriendModal Bottom Sheet ── */}")

with open("app/(home)/messages.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
