import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Icon } from '../../src/components/Icon';
import { LunaIcon } from '../../src/components/LunaIcons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { AppBackground } from '../../src/components/AppBackground';
import { PageHeader } from '../../src/components/PageHeader';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Revenue-driving quick question categories with icons and colors
const QUICK_CATEGORIES = [
  {
    id: 'tonight',
    icon: 'flame',
    title: "What's Hot",
    gradient: ['#FF6B6B', '#EE5A5A'],
    questions: [
      "What's the vibe tonight?",
      "Best club right now?",
      "Any events ending soon?",
    ]
  },
  {
    id: 'vip',
    icon: 'diamond',
    title: 'VIP Access',
    gradient: ['#FFD700', '#FFA500'],
    questions: [
      "How do I get VIP access?",
      "Skip the queue tonight",
      "Best venue for tonight?",
    ]
  },
  {
    id: 'points',
    icon: 'star',
    title: 'My Rewards',
    gradient: ['#00D9FF', '#0099FF'],
    questions: [
      "How many points do I have?",
      "What can I redeem?",
      "Double points deals?",
    ]
  },
  {
    id: 'info',
    icon: 'information-circle',
    title: 'Quick Info',
    gradient: ['#A855F7', '#7C3AED'],
    questions: [
      "Dress code tonight?",
      "What time does it close?",
      "Entry fee?",
    ]
  },
];

// Suggested prompts that appear inline
const INLINE_SUGGESTIONS = [
  "Get me in VIP tonight",
  "What's the move this weekend?",
  "Surprise me with something fun",
  "Where's the afterparty?",
];

export default function LunaAIScreen() {
  const user = useAuthStore((state) => state.user);
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showQuickCards, setShowQuickCards] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Track keyboard visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Pulse animation for the AI indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Load messages from storage on mount
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const savedMessages = await AsyncStorage.getItem('luna_chat_messages');
        const savedSessionId = await AsyncStorage.getItem('luna_chat_session');
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages);
          // Convert timestamp strings back to Date objects
          const messagesWithDates = parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
          setMessages(messagesWithDates);
          setShowQuickCards(messagesWithDates.length <= 1);
        }
        if (savedSessionId) {
          setSessionId(savedSessionId);
        }
      } catch (e) {
        console.log('Failed to load chat history');
      }
    };
    loadMessages();
  }, []);

  // Save messages whenever they change
  useEffect(() => {
    const saveMessages = async () => {
      try {
        if (messages.length > 0) {
          await AsyncStorage.setItem('luna_chat_messages', JSON.stringify(messages));
        }
        if (sessionId) {
          await AsyncStorage.setItem('luna_chat_session', sessionId);
        }
      } catch (e) {
        console.log('Failed to save chat history');
      }
    };
    saveMessages();
  }, [messages, sessionId]);

  // Initialize welcome message if no messages exist
  useFocusEffect(
    useCallback(() => {
      if (messages.length === 0) {
        const hour = new Date().getHours();
        let greeting = 'Hey';
        if (hour >= 18) greeting = 'Hey night owl';
        else if (hour >= 12) greeting = 'What\'s good';
        else greeting = 'Morning';

        const welcomeMessage: Message = {
          id: 'welcome',
          role: 'assistant',
          content: `${greeting}, ${user?.name?.split(' ')[0] || 'babe'}! I'm Luna - your personal nightlife concierge. Need the hottest spots, VIP access, or just wanna know what's worth your time tonight? Ask away.`,
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
      }
    }, [messages.length])
  );

  // Dismiss keyboard on tap outside
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText || isLoading) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Hide quick cards after first message
    setShowQuickCards(false);
    setSelectedCategory(null);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await api.aiChat(messageText, sessionId || undefined);
      
      if (response.session_id) {
        setSessionId(response.session_id);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response || "Hmm, I'm having a moment. Try that again?",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('AI chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Oops, something went sideways. Give it another shot?",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setSelectedCategory(selectedCategory === categoryId ? null : categoryId);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.role === 'user';
    
    return (
      <Animated.View 
        style={[
          styles.messageWrapper,
          isUser && styles.userMessageWrapper,
          { opacity: 1 }
        ]}
      >
        {!isUser && (
          <View style={styles.aiAvatarWrapper}>
            <LinearGradient
              colors={[colors.accent, colors.accentDark]}
              style={styles.aiAvatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <LunaIcon name="aiMoon" size={16} color="#fff" />
            </LinearGradient>
            <View style={styles.aiOnlineIndicator} />
          </View>
        )}
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble
        ]}>
          {isUser ? (
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.userBubbleGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.userMessageText}>{item.content}</Text>
            </LinearGradient>
          ) : (
            <Text style={styles.aiMessageText}>{item.content}</Text>
          )}
        </View>
      </Animated.View>
    );
  };

  const renderQuickCategory = (category: typeof QUICK_CATEGORIES[0]) => {
    const isSelected = selectedCategory === category.id;
    
    return (
      <View key={category.id} style={styles.categoryWrapper}>
        <TouchableOpacity
          style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
          onPress={() => handleCategorySelect(category.id)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={category.gradient}
            style={styles.categoryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon name={category.icon as any} size={22} color="#fff" />
          </LinearGradient>
          <Text style={styles.categoryTitle}>{category.title}</Text>
          <Icon 
            name={isSelected ? "chevron-up" : "chevron-down"} 
            size={16} 
            color={colors.textMuted} 
          />
        </TouchableOpacity>
        
        {isSelected && (
          <View style={styles.categoryQuestions}>
            {category.questions.map((question, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.questionPill}
                onPress={() => handleSendMessage(question)}
                activeOpacity={0.8}
              >
                <Text style={styles.questionPillText}>{question}</Text>
                <Icon name="arrow-forward-circle" size={18} color={category.gradient[0]} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
      <View style={styles.container}>
        <AppBackground />

        {/* New Chat action (no logo header per design) */}
        <View style={[styles.subHeaderRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            style={styles.newChatBtn}
            onPress={async () => {
              setMessages([]);
              setSessionId(null);
              setShowQuickCards(true);
              setSelectedCategory(null);
              try {
                await AsyncStorage.removeItem('luna_chat_messages');
                await AsyncStorage.removeItem('luna_chat_session');
              } catch (e) {}
            }}
          >
            <Icon name="add-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.newChatLabel}>New Chat</Text>
          </TouchableOpacity>
        </View>

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom + 50 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.typingWrapper}>
                <View style={styles.aiAvatarWrapper}>
                  <LinearGradient
                    colors={[colors.accent, colors.accentDark]}
                    style={styles.aiAvatar}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <LunaIcon name="aiMoon" size={16} color="#fff" />
                  </LinearGradient>
                </View>
                <View style={styles.typingBubble}>
                  <View style={styles.typingDots}>
                    <Animated.View style={[styles.typingDot, { backgroundColor: colors.accent }]} />
                    <Animated.View style={[styles.typingDot, { backgroundColor: colors.accentBright }]} />
                    <Animated.View style={[styles.typingDot, { backgroundColor: colors.accentVibrant }]} />
                  </View>
                </View>
              </View>
            ) : null
          }
        />

        {/* Quick Question Cards - Premium Design */}
        {showQuickCards && messages.length <= 1 && (
          <View style={styles.quickCardsContainer}>
            <Text style={styles.quickCardsTitle}>What can Luna help with?</Text>
            <View style={styles.categoriesGrid}>
              {QUICK_CATEGORIES.map(renderQuickCategory)}
            </View>
            
            {/* Inline Suggestions */}
            <View style={styles.inlineSuggestionsWrapper}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.inlineSuggestions}
              >
                {INLINE_SUGGESTIONS.map((suggestion, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.inlineSuggestionPill}
                    onPress={() => handleSendMessage(suggestion)}
                    activeOpacity={0.8}
                  >
                    <Icon name="flash" size={12} color={colors.accent} />
                    <Text style={styles.inlineSuggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Premium Input Area */}
        <View style={[styles.inputContainer, { paddingBottom: keyboardVisible ? 4 : 8 }]}>
          <BlurView intensity={60} style={styles.inputBlur}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Ask Luna anything..."
                placeholderTextColor={colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={() => handleSendMessage()}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
                onPress={() => handleSendMessage()}
                disabled={!inputText.trim() || isLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={inputText.trim() && !isLoading 
                    ? [colors.accent, colors.accentDark] 
                    : [colors.surfaceElevated, colors.surface]}
                  style={styles.sendButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Icon 
                    name="arrow-up" 
                    size={20} 
                    color={inputText.trim() && !isLoading ? '#fff' : colors.textMuted} 
                  />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // Header Styles
  header: {
    borderBottomWidth: 0,
    zIndex: 10,
  },
  headerBlur: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconWrapper: {
    marginRight: spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  aiTag: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accentGlow,
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  newChatLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    marginTop: -12,
    marginBottom: spacing.sm,
  },
  // Chat Container
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  // Message Styles
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    alignItems: 'flex-end',
  },
  userMessageWrapper: {
    justifyContent: 'flex-end',
  },
  aiAvatarWrapper: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiOnlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00D26A',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: radius.lg + 4,
  },
  userBubble: {
    borderBottomRightRadius: radius.xs,
  },
  userBubbleGradient: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    borderRadius: radius.lg + 4,
    borderBottomRightRadius: radius.xs,
  },
  aiBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  userMessageText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 22,
    fontWeight: '500',
  },
  aiMessageText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 23,
    fontWeight: '400',
  },
  // Typing Indicator
  typingWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  typingBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  typingDots: {
    flexDirection: 'row',
    gap: 6,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Quick Cards
  quickCardsContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    maxHeight: 280,
  },
  quickCardsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  categoryWrapper: {
    width: '48%',
    marginBottom: spacing.xs,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  categoryCardSelected: {
    borderColor: colors.accentGlow,
    backgroundColor: colors.accentDim,
  },
  categoryGradient: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  categoryTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  categoryQuestions: {
    marginTop: spacing.xs,
    paddingLeft: spacing.xs,
    gap: 4,
  },
  questionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.glass,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorderSubtle,
  },
  questionPillText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  // Inline Suggestions
  inlineSuggestionsWrapper: {
    marginTop: spacing.sm,
  },
  inlineSuggestions: {
    gap: spacing.xs,
    paddingRight: spacing.lg,
  },
  inlineSuggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentDim,
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.accentGlow,
  },
  inlineSuggestionText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
  },
  // Input Area
  inputContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  inputBlur: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: spacing.md + 2,
    paddingRight: spacing.xs + 2,
    paddingVertical: spacing.xs + 2,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    maxHeight: 120,
    paddingVertical: spacing.sm + 2,
    fontWeight: '500',
  },
  sendButton: {
    marginLeft: spacing.sm,
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
