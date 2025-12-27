'use client';

import * as React from 'react';

import type { TComboboxInputElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';

import { getMentionOnSelectItem } from '@platejs/mention';
import { Megaphone, Users } from 'lucide-react';
import { PlateElement } from 'platejs/react';
import { useQuery } from 'convex/react';
import * as apiModule from '../../../convex/_generated/api';

// Type workaround: Convex's API has excessively deep type nesting.
// We use dynamic property access to avoid TS2589 "Type instantiation is excessively deep" errors.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (apiModule as any).api;
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
} from '@/components/ui/inline-combobox';

/** User result from Convex search query */
interface SearchUserResult {
  _id: string;
  name: string;
  avatarUrl?: string;
  role: 'user' | 'admin';
}

/** Mention item type for distinguishing special mentions from user mentions */
type MentionItemType = 'user' | 'special';

/** Mention item for the combobox */
interface MentionItem {
  key: string;
  text: string;
  type: MentionItemType;
  data: {
    avatarUrl?: string;
    role?: 'user' | 'admin';
    description?: string;
    icon?: 'users' | 'megaphone';
  };
}

/** Special mention configuration */
interface SpecialMention {
  key: string;
  text: string;
  description: string;
  icon: 'users' | 'megaphone';
  keywords: string[];
  /** If true, only admins can use this mention */
  adminOnly?: boolean;
}

/** Available special mentions */
const SPECIAL_MENTIONS: SpecialMention[] = [
  {
    key: 'special:here',
    text: 'here',
    description: 'Notify online members',
    icon: 'users',
    keywords: ['here', 'online', 'active'],
    adminOnly: false,
  },
  {
    key: 'special:everyone',
    text: 'everyone',
    description: 'Notify all members',
    icon: 'megaphone',
    keywords: ['everyone', 'all', 'channel'],
    adminOnly: true, // Only admins can use @everyone
  },
];

/**
 * Custom MentionInputElement for messaging that queries Convex users.
 * Shows user avatars and names in the combobox dropdown.
 * Also supports @here and @everyone special mentions.
 */
export function MentionInputMessaging(
  props: PlateElementProps<TComboboxInputElement>
): React.ReactElement {
  const { editor, element } = props;
  const [search, setSearch] = React.useState('');

  // Get current user to check admin status for @everyone
  const currentUser = useQuery(api.users.me) as { role: 'user' | 'admin' } | undefined;
  const isAdmin = currentUser?.role === 'admin';

  // Query users from Convex when search has 2+ characters
  const users = useQuery(
    api.users.search,
    search.length >= 2 ? { query: search, limit: 8 } : 'skip'
  ) as SearchUserResult[] | undefined;

  const onSelectItem = React.useMemo(() => getMentionOnSelectItem(), []);

  // Filter and transform special mentions based on search text and user permissions
  const specialMentionItems: MentionItem[] = React.useMemo(() => {
    const searchLower = search.toLowerCase().trim();

    return SPECIAL_MENTIONS
      .filter((mention) => {
        // Check admin permission for admin-only mentions
        if (mention.adminOnly && !isAdmin) {
          return false;
        }
        // Show all special mentions when search is empty
        if (searchLower === '') {
          return true;
        }
        // Filter by text or keywords
        return (
          mention.text.toLowerCase().includes(searchLower) ||
          mention.keywords.some((kw) => kw.toLowerCase().includes(searchLower))
        );
      })
      .map((mention) => ({
        key: mention.key,
        text: mention.text,
        type: 'special' as const,
        data: {
          description: mention.description,
          icon: mention.icon,
        },
      }));
  }, [search, isAdmin]);

  // Transform users to combobox items format
  const userMentionItems: MentionItem[] = React.useMemo(() => {
    if (!users) return [];
    return users.map((user: SearchUserResult) => ({
      key: user._id,
      text: user.name,
      type: 'user' as const,
      data: {
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    }));
  }, [users]);

  // Get initials for avatar fallback
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Determine empty state message
  const hasResults = specialMentionItems.length > 0 || userMentionItems.length > 0;
  const emptyMessage = search.length < 2
    ? 'Type to search users...'
    : 'No users found';

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox
        value={search}
        element={element}
        setValue={setSearch}
        showTrigger={false}
        trigger="@"
        filter={false} // Disable client-side filtering since Convex does the search
      >
        <span className="inline-block rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm ring-ring focus-within:ring-2">
          <InlineComboboxInput aria-label="Search users to mention" />
        </span>

        <InlineComboboxContent className="my-1.5">
          {!hasResults && (
            <InlineComboboxEmpty>{emptyMessage}</InlineComboboxEmpty>
          )}

          {/* Special Mentions Group - @here, @everyone */}
          {specialMentionItems.length > 0 && (
            <InlineComboboxGroup>
              <InlineComboboxGroupLabel>Quick Mentions</InlineComboboxGroupLabel>
              {specialMentionItems.map((item) => (
                <InlineComboboxItem
                  key={item.key}
                  value={item.text}
                  onClick={() => onSelectItem(editor, item, search)}
                  className="gap-2"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {item.data.icon === 'users' ? (
                      <Users className="size-3.5" aria-hidden="true" />
                    ) : (
                      <Megaphone className="size-3.5" aria-hidden="true" />
                    )}
                  </span>
                  <span className="flex flex-1 flex-col gap-0">
                    <span className="font-medium">@{item.text}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.data.description}
                    </span>
                  </span>
                </InlineComboboxItem>
              ))}
            </InlineComboboxGroup>
          )}

          {/* Users Group */}
          {userMentionItems.length > 0 && (
            <InlineComboboxGroup>
              <InlineComboboxGroupLabel>Users</InlineComboboxGroupLabel>
              {userMentionItems.map((item) => (
                <InlineComboboxItem
                  key={item.key}
                  value={item.text}
                  onClick={() => onSelectItem(editor, item, search)}
                  className="gap-2"
                >
                  <Avatar size="sm">
                    {item.data.avatarUrl && (
                      <AvatarImage src={item.data.avatarUrl} alt={item.text} />
                    )}
                    <AvatarFallback>{getInitials(item.text)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">{item.text}</span>
                  {item.data.role === 'admin' && (
                    <span className="text-xs text-muted-foreground">
                      <span className="sr-only">User role: </span>Admin
                    </span>
                  )}
                </InlineComboboxItem>
              ))}
            </InlineComboboxGroup>
          )}
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}
