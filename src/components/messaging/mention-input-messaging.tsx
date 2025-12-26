'use client';

import * as React from 'react';

import type { TComboboxInputElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';

import { getMentionOnSelectItem } from '@platejs/mention';
import { PlateElement } from 'platejs/react';
import { useQuery } from 'convex/react';

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require('../../../convex/_generated/api').api;
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
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

/** Mention item for the combobox */
interface MentionItem {
  key: string;
  text: string;
  data: {
    avatarUrl?: string;
    role: 'user' | 'admin';
  };
}

/**
 * Custom MentionInputElement for messaging that queries Convex users.
 * Shows user avatars and names in the combobox dropdown.
 */
export function MentionInputMessaging(
  props: PlateElementProps<TComboboxInputElement>
): React.ReactElement {
  const { editor, element } = props;
  const [search, setSearch] = React.useState('');

  // Query users from Convex when search has 2+ characters
  const users = useQuery(
    api.users.search,
    search.length >= 2 ? { query: search, limit: 8 } : 'skip'
  ) as SearchUserResult[] | undefined;

  const onSelectItem = React.useMemo(() => getMentionOnSelectItem(), []);

  // Transform users to combobox items format
  const mentionItems: MentionItem[] = React.useMemo(() => {
    if (!users) return [];
    return users.map((user: SearchUserResult) => ({
      key: user._id,
      text: user.name,
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
          <InlineComboboxEmpty>
            {search.length < 2 ? 'Type to search users...' : 'No users found'}
          </InlineComboboxEmpty>

          <InlineComboboxGroup>
            {mentionItems.map((item) => (
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
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}
