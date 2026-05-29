with open("new.txt", "w", encoding="utf-8") as f:
    f.write("""      <AnimatedFlatList
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140, paddingTop: insets.top + 110, minHeight: H + insets.top + 240 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing} onRefresh={onRefresh}
            tintColor={primary} colors={[primary]}
            progressViewOffset={insets.top + 110}
          />
        }
        data={loading ? [] : filtered}
        keyExtractor={(item: any) => `${item.friend_id}-${item.request_status || 'none'}`}
        ListHeaderComponent={
          <>
            {/* ── Large title inside scroll (Samsung style) ── */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
              <Animated.Text style={[s.titleLarge, { color: text }, largeTitleStyle]}>
                Messages
              </Animated.Text>
            </View>

            {/* ── Online shelf with top curve (sticky, won't scroll into header) ── */}
            {!search && (
              <View style={[s.shelf, { 
                backgroundColor: isDark ? 'rgba(25,25,40,0.95)' : 'rgba(252,252,255,0.95)', 
                borderTopLeftRadius: 28, 
                borderTopRightRadius: 28, 
                overflow: 'hidden', 
                marginTop: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.3 : 0.08,
                shadowRadius: 8,
                elevation: 4,
              }]}>
                {/* Top curve SVG */}
                <Svg width={W} height={28} viewBox={`0 0 ${W} 28`} style={{ position: 'absolute', top: 0, left: 0 }}>
                  <Path
                    d={`M0,10 Q${W/2},0 ${W},10 L${W},0 L0,0 Z`}
                    fill={isDark ? 'rgba(25,25,40,0.95)' : 'rgba(252,252,255,0.95)'}
                  />
                </Svg>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shelfRow}>
                  {/* Add friend button */}
                  <View style={s.shelfItem}>
                    <TouchableOpacity
                      style={[s.addCircle, { borderColor: `${primary}55` }]}
                      onPress={() => setAddFriendModalVisible(true)}
                    >
                      <LinearGradient
                        colors={['rgba(99,102,241,0.15)','rgba(139,92,246,0.1)']}
                        style={[StyleSheet.absoluteFill, { borderRadius: 27 }]}
                      />
                      <Ionicons name="add" size={26} color={primary} />
                    </TouchableOpacity>
                    <Text style={[s.shelfName, { color: textTert }]} >Add</Text>
                  </View>

                  {/* Online friends */}
                  {onlineFriends.map((f, i) => (
                    <Animated.View key={f.friend_id} entering={FadeIn.delay(i * 50)} style={s.shelfItem}>
                      <Pressable onPress={() => goToChat(f)}>
                        <LinearGradient
                          colors={[primary, accent]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                          style={s.onlineRing}
                        >
                          <View style={[s.avatarInner, { backgroundColor: avatarColor(f.friend_id), overflow: 'hidden' }]}>
                            {f.avatar ? (
                              <Image 
                                source={{ uri: f.avatar }} 
                                style={{ width: '100%', height: '100%' }} 
                                resizeMode="cover"
                              />
                            ) : (
                              <Text style={s.avatarTxt}>
                                {(f.username || '?').slice(0, 1).toUpperCase()}
                              </Text>
                            )}
                          </View>
                        </LinearGradient>
                        <View style={[s.onlineDot, { borderColor: isDark ? '#080810' : '#f8f9ff' }]} />
                      </Pressable>
                      <Text style={[s.shelfName, { color: textSub }]} numberOfLines={1}>
                        {(f.username || '').split(' ')[0]}
                      </Text>
                    </Animated.View>
                  ))}

                  {/* If no online friends show placeholder */}
                  {onlineFriends.length === 0 && (
                    <Text style={[{ color: textTert, fontSize: 13, paddingVertical: 8, fontStyle: 'italic' }]}>
                      No one online right now
                    </Text>
                  )}
                </ScrollView>
              </View>
            )}

            {/* ── Free middle space (background shows through) ── */}
            {!search && <View style={{ height: 24 }} />}

            {/* ── Chat list container (its own curved surface with distinct color) ── */}
            <View style={[s.chatContainer, { 
              backgroundColor: isDark ? 'rgba(20,20,32,0.85)' : 'rgba(248,249,255,0.9)', 
              borderTopLeftRadius: 28, 
              borderTopRightRadius: 28, 
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
              paddingBottom: 20,
            }]}>
              {!search && (
                <Svg width={W} height={28} viewBox={`0 0 ${W} 28`} style={{ position: 'absolute', top: 0, left: 0 }}>
                  <Path
                    d={`M0,10 Q${W/2},0 ${W},10 L${W},0 L0,0 Z`}
                    fill={isDark ? 'rgba(20,20,32,0.85)' : 'rgba(248,249,255,0.9)'}
                  />
                </Svg>
              )}

              {/* ── Section label ── */}
              <View style={s.sectionRow}>
                <Text style={[s.sectionLabel, { color: textTert }]}>
                  {search ? (searchResults.length > 0 ? `${searchResults.length} found` : 'No results') : 'Recent'}
                </Text>
                {!search && conversations.length > 0 && (
                  <Text style={[s.sectionCount, { color: textTert }]}>{conversations.length}</Text>
                )}
              </View>

              {loading && (
                [1, 2, 3, 4, 5].map(i => (
                  <View
                    key={i}
                    style={[
                      s.skeleton,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                        opacity: 1 - i * 0.15,
                      },
                    ]}
                  />
                ))
              )}
          </>
        }
        renderItem={({ item, index }: any) => (
          <View style={{ backgroundColor: isDark ? 'rgba(20,20,32,0.85)' : 'rgba(248,249,255,0.9)' }}>
            <Animated.View
              entering={FadeInDown.delay(index * 40).springify().damping(18)}
            >
              <ConversationCard
                conversation={item}
                onPress={() => goToChat(item)}
                onDelete={() => handleDelete(item)}
                isDark={isDark}
              />
            </Animated.View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={[s.emptyWrap, { backgroundColor: isDark ? 'rgba(20,20,32,0.85)' : 'rgba(248,249,255,0.9)', paddingBottom: 40 }]}>
              <LinearGradient
                colors={['rgba(99,102,241,0.12)', 'rgba(139,92,246,0.07)']}
                style={[s.emptyIcon, { borderColor: `${primary}33` }]}
              >
                <Ionicons name="chatbubbles-outline" size={34} color={primary} />
              </LinearGradient>
              <Text style={[s.emptyTitle, { color: text }]}>
                {search ? 'No conversations found' : 'No messages yet'}
              </Text>
              <Text style={[s.emptySub, { color: textSub }]}>
             
