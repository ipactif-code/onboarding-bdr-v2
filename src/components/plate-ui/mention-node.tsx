'use client';

import { DatePlugin } from '@platejs/date/react';
import { MentionPlugin } from '@platejs/mention/react';
import { useQuery } from 'convex/react';
import { ArrowUpRightIcon, FileTextIcon, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { IS_APPLE, type Value } from 'platejs';
import {
  PlateElement,
  type PlateElementProps,
  useEditorRef,
  useFocused,
  useHotkeys,
  usePlateEditor,
  useReadOnly,
  useSelected,
} from 'platejs/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useMounted } from 'react-tweet';
import { cn } from '@/lib/utils';
import { BaseEditorKit } from '@/components/editor/editor-base-kit';
import type { MyMentionElement } from '@/components/editor/plate-types';
import { insertInlineElement } from '@/components/editor/transforms';
import { useDebounce } from '@/hooks/use-debounce';

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require('../../../convex/_generated/api').api;

import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { EditorStatic } from './editor-static';
import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card';
import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
} from './inline-combobox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

type DocumentItem = {
  id: string;
  contentRich: {
    children: { text: string }[];
    type: string;
  }[];
  coverImage: string;
  icon: string;
  title: string;
};

type PeopleComboboxGroupProps = {
  search: string;
  onUserHover: (name: string) => void;
  onUserSelect: (user: UserItem) => void;
};

export const mockMentionDocuments = [
  {
    id: 'docs/examples/ai',
    contentRich: [
      {
        children: [
          {
            text: 'A comprehensive guide to using AI features in your documents.',
          },
        ],
        type: 'p',
      },
    ],
    coverImage: 'https://picsum.photos/seed/ai/800/400',
    icon: '📋',
    title: 'AI',
  },
  {
    id: 'docs/examples/callout',
    contentRich: [
      {
        children: [
          {
            text: 'Learn how to use callouts to highlight important information.',
          },
        ],
        type: 'p',
      },
    ],
    coverImage: 'https://picsum.photos/seed/callout/800/400',
    icon: '🧰',
    title: 'Callout',
  },
  {
    id: 'docs/examples/equation',
    contentRich: [
      {
        children: [
          { text: 'Everything you need to know about mathematical equations.' },
        ],
        type: 'p',
      },
    ],
    coverImage: 'https://picsum.photos/seed/equation/800/400',
    icon: '🧮',
    title: 'Equation',
  },
  {
    id: 'docs/examples/toc',
    contentRich: [
      {
        children: [
          {
            text: 'How to create and manage table of contents in your documents.',
          },
        ],
        type: 'p',
      },
    ],
    coverImage: 'https://picsum.photos/seed/toc/800/400',
    icon: '📚',
    title: 'Table of Contents',
  },
];

type UserItem = {
  id: string;
  name: string;
  avatarUrl?: string;
};

export function MentionInputElement(props: PlateElementProps): React.ReactElement {
  const [placeholder, setPlaceholder] = useState(
    'Mention a person,page,or date...'
  );

  const { children, editor, element } = props;
  const [search, setSearch] = React.useState('');

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox
        element={element}
        setValue={setSearch}
        showTrigger={false}
        trigger="@"
        value={search}
      >
        <span className="rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm ring-ring">
          <span className="font-bold">@</span>
          <InlineComboboxInput
            className="min-w-[100px]"
            placeholder={placeholder}
          />
        </span>

        <InlineComboboxContent variant="mention">
          <InlineComboboxEmpty>No results found</InlineComboboxEmpty>

          <InlineComboboxGroup>
            <InlineComboboxGroupLabel>Date</InlineComboboxGroupLabel>
            <InlineComboboxItem
              onClick={() => {
                insertInlineElement(editor, DatePlugin.key);
              }}
              onFocus={() => setPlaceholder('Today')}
              onMouseEnter={() => setPlaceholder('Today')}
              value="today"
            >
              <span>Today</span>
              <span className="mx-1 text-muted-foreground">—</span>
              <span className="font-medium text-muted-foreground text-xs">
                {new Date().toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </InlineComboboxItem>
          </InlineComboboxGroup>

          <DocumentComboboxGroup
            onDocumentHover={(name) => setPlaceholder(name)}
            onDocumentSelect={(document) => {
              editor.tf.insertNodes<MyMentionElement>({
                key: `/${document.id}`,
                children: [{ text: '' }],
                coverImage: document.coverImage ?? undefined,
                icon: document.icon ?? undefined,
                type: MentionPlugin.key,
                value: document.title!,
              });
              editor.tf.move({ unit: 'offset' });
            }}
            search={search}
          />

          <PeopleComboboxGroup
            onUserHover={(name) => setPlaceholder(name)}
            onUserSelect={(user) => {
              editor.tf.insertNodes<MyMentionElement>({
                key: user.id,
                children: [{ text: '' }],
                type: MentionPlugin.key,
                value: user.name,
              });
              editor.tf.move({ unit: 'offset' });
            }}
            search={search}
          />
        </InlineComboboxContent>
      </InlineCombobox>
      {children}
    </PlateElement>
  );
}

type DocumentComboboxGroupProps = {
  search: string;
  onDocumentHover: (title: string) => void;
  onDocumentSelect: (document: DocumentItem) => void;
};

function PeopleComboboxGroup({
  search: searchRaw,
  onUserHover,
  onUserSelect,
}: PeopleComboboxGroupProps): React.ReactElement | null {
  const search = useDebounce(searchRaw, 100);

  // Query users from Convex - always query to show suggestions immediately
  // Empty query returns recent/suggested users
  const usersData = useQuery(api.users.search, { query: search, limit: 10 });

  // Show loading state while query is in progress
  const isLoading = usersData === undefined;

  // Transform Convex user data to match UserItem interface
  const allUsers = useMemo(() => {
    if (!usersData) return [];
    return usersData.map((user: { _id: string; name: string; avatarUrl?: string }) => ({
      id: user._id,
      name: user.name,
      avatarUrl: user.avatarUrl,
    }));
  }, [usersData]);

  // Show loading indicator when searching
  if (isLoading) {
    return (
      <InlineComboboxGroup>
        <InlineComboboxGroupLabel>People</InlineComboboxGroupLabel>
        <div className="flex items-center justify-center py-2">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
        </div>
      </InlineComboboxGroup>
    );
  }

  if (allUsers.length === 0) {
    // Show empty state when no users found
    return (
      <InlineComboboxGroup>
        <InlineComboboxGroupLabel>People</InlineComboboxGroupLabel>
        <div className="px-2 py-2 text-sm text-muted-foreground">
          No users found
        </div>
      </InlineComboboxGroup>
    );
  }

  return (
    <InlineComboboxGroup>
      <InlineComboboxGroupLabel>People</InlineComboboxGroupLabel>

      {allUsers.map((user: UserItem) => (
        <InlineComboboxItem
          key={user.id}
          onClick={() => onUserSelect(user)}
          onFocus={() => onUserHover(user.name)}
          onMouseEnter={() => onUserHover(user.name)}
          value={user.name}
        >
          <Avatar className="mr-2.5 size-5">
            {user.avatarUrl && <AvatarImage alt={user.name} src={user.avatarUrl} />}
            <AvatarFallback>
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {user.name}
        </InlineComboboxItem>
      ))}
    </InlineComboboxGroup>
  );
}

function DocumentComboboxGroup({
  search: searchRaw,
  onDocumentHover,
  onDocumentSelect,
}: DocumentComboboxGroupProps): React.ReactElement | null {
  const search = useDebounce(searchRaw, 100);

  // Query KB documents from Convex - always query to show suggestions immediately
  // Empty query returns recent/suggested documents
  const documentsData = useQuery(api.knowledge.documents.search, {
    query: search,
    limit: 10,
  });

  // Show loading state while query is in progress
  const isLoading = documentsData === undefined;

  // Transform Convex document data to match DocumentItem interface
  const allDocuments = useMemo(() => {
    if (!documentsData) return [];
    return documentsData.map((doc: { _id: string; title: string; icon?: string; folderId: string }) => ({
      id: doc._id,
      title: doc.title,
      icon: doc.icon,
      // Minimal data needed for mention insertion
      contentRich: [],
      coverImage: '',
    }));
  }, [documentsData]);

  // Show loading indicator when searching
  if (isLoading) {
    return (
      <InlineComboboxGroup>
        <InlineComboboxGroupLabel>Pages</InlineComboboxGroupLabel>
        <div className="flex items-center justify-center py-2">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
        </div>
      </InlineComboboxGroup>
    );
  }

  if (allDocuments.length === 0) {
    // Show empty state when no documents found
    return (
      <InlineComboboxGroup>
        <InlineComboboxGroupLabel>Pages</InlineComboboxGroupLabel>
        <div className="px-2 py-2 text-sm text-muted-foreground">
          No documents found
        </div>
      </InlineComboboxGroup>
    );
  }

  return (
    <InlineComboboxGroup>
      <InlineComboboxGroupLabel>Pages</InlineComboboxGroupLabel>

      {allDocuments.map((document: DocumentItem) => (
        <InlineComboboxItem
          key={document.id}
          onClick={() => onDocumentSelect(document)}
          onFocus={() => onDocumentHover(document.title ?? '')}
          onMouseEnter={() => onDocumentHover(document.title ?? '')}
          value={document.title || 'Untitled Document'}
        >
          <span className="mr-2 size-5">
            {document.icon ?? <FileTextIcon className="size-5" />}
          </span>
          {document.title ?? 'Untitled Document'}
        </InlineComboboxItem>
      ))}
    </InlineComboboxGroup>
  );
}

const openDocument = (id: string): void => {
  // Navigate to KB document page
  // The id is the Convex document ID (e.g., "j572k3...")
  window.open(`/knowledge/doc/${id}`, '_self');
};

function DocumentMentionElement(
  props: PlateElementProps<MyMentionElement> & {
    prefix?: string;
  }
): React.ReactElement {
  const { children } = props;
  const element = props.element;
  const selected = useSelected();
  const focused = useFocused();

  useHotkeys(
    'enter',
    () => {
      if (selected && focused) {
        openDocument(element.key!.slice(1));
      }
    },
    {
      enabled: selected && focused,
      enableOnContentEditable: true,
      enableOnFormTags: true,
    }
  );

  return (
    <TooltipProvider>
      <Tooltip open={selected && focused}>
        <HoverCard closeDelay={0} openDelay={0}>
          <HoverCardTrigger contentEditable={false}>
            <TooltipTrigger contentEditable={false}>
              <PlateElement
                {...props}
                attributes={{
                  ...props.attributes,
                  contentEditable: false,
                  'data-slate-value': element.value,
                  draggable: true,
                  onClick: () => {
                    openDocument(element.key!.slice(1));
                  },
                  onMouseDown: (e) => e.preventDefault(),
                }}
                className={cn(
                  'inline-block cursor-pointer rounded px-0.5 hover:bg-muted',
                  selected && focused && 'bg-brand/25'
                )}
              >
                {props.prefix}
                <span className="relative mr-3 inline-block">
                  {element.icon}
                  <ArrowUpRightIcon className="-right-3 absolute bottom-0 size-3.5 font-bold" />
                </span>
                <span className="border-b-1 font-medium">{element.value}</span>
                {children}
              </PlateElement>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                <span className="mr-1">Open Page</span>
                <kbd>↵</kbd>
              </p>
            </TooltipContent>
          </HoverCardTrigger>
          <HoverCardContent className="relative p-0 pb-4">
            <MentionHoverCardContent element={element} />
          </HoverCardContent>
        </HoverCard>
      </Tooltip>
    </TooltipProvider>
  );
}

function MentionHoverCardContent(props: { element: MyMentionElement }): React.ReactElement {
  const editor = useEditorRef();
  const { element } = props;

  const isDocument = element.key!.startsWith('/');

  // Find the document from mockDocuments
  const document = React.useMemo(() => {
    if (!isDocument) return null;

    return mockMentionDocuments.find((doc) => doc.id === element.key!.slice(1));
  }, [element.key, isDocument]);

  useEffect(() => {
    if (!document) return;
    if (
      element.coverImage !== document.coverImage ||
      element.icon !== document.icon ||
      element.value !== document.title
    ) {
      editor.tf.setNodes<MyMentionElement>(
        {
          coverImage: document.coverImage,
          icon: document.icon,
          value: document.title,
        },
        {
          at: [],
          mode: 'lowest',
          match: (n) => n.type === MentionPlugin.key && n.id === element.id,
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document]);

  const previewEditor = useEditorPreview(
    (document?.contentRich as Value | undefined)?.slice(0, 2) ?? []
  );

  return (
    <div className="flex flex-col overflow-hidden rounded">
      <div className={cn('h-10 w-full')}>
        {element.coverImage && (
          <Image
            alt={element.value}
            className="size-full object-cover"
            height={40}
            src={element.coverImage}
            width={100}
          />
        )}
      </div>
      <div className="absolute top-5 left-4 text-[30px]">{element.icon}</div>
      <h1 className="mt-5 px-4 font-bold text-lg">{element.value}</h1>
      {previewEditor && (
        <EditorStatic
          className="px-4 text-xs"
          editor={previewEditor}
          // components={basicComponents}
          variant="mention"
        />
      )}
    </div>
  );
}

function UserMentionElement(
  props: PlateElementProps<MyMentionElement> & {
    prefix?: string;
  }
): React.ReactElement {
  const { children } = props;
  const element = props.element;
  const readOnly = useReadOnly();
  const mounted = useMounted();

  return (
    <PlateElement
      {...props}
      attributes={{
        ...props.attributes,
        contentEditable: false,
        'data-slate-value': element.value,
        draggable: true,
      }}
      className={cn(
        'inline-block cursor-pointer align-baseline font-medium text-primary/65',
        !readOnly && 'cursor-pointer',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (element.children[0] as any).bold === true && 'font-bold',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (element.children[0] as any).italic === true && 'italic',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (element.children[0] as any).underline === true && 'underline'
      )}
    >
      <span className="font-semibold text-primary/45">@</span>
      {mounted && IS_APPLE ? (
        // Mac OS IME https://github.com/ianstormtaylor/slate/issues/3490
        <>
          {children}
          {props.prefix}
          {element.value}
        </>
      ) : (
        // Others like Android https://github.com/ianstormtaylor/slate/pull/5360
        <>
          {props.prefix}
          {element.value}
          {children}
        </>
      )}
    </PlateElement>
  );
}

export function MentionElement(
  props: PlateElementProps<MyMentionElement> & {
    prefix?: string;
  }
): React.ReactElement {
  const element = props.element;
  const isDocument = element.key?.startsWith('/');

  return isDocument ? (
    <DocumentMentionElement {...props} />
  ) : (
    <UserMentionElement {...props} />
  );
}

const useEditorPreview = (value: Value): ReturnType<typeof usePlateEditor> => {
  const editorStatic = usePlateEditor(
    {
      plugins: BaseEditorKit,
      value,
    },
    [value]
  );

  return editorStatic;
};
