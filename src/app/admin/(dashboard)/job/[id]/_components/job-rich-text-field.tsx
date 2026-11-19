'use client';

import { useEffect, useRef, useState } from 'react';
import { Group, Text } from '@mantine/core';
import { RichTextEditor as RTE, Link } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Superscript from '@tiptap/extension-superscript';
import SubScript from '@tiptap/extension-subscript';
import Highlight from '@tiptap/extension-highlight';

export function JobRichTextField({
  label,
  required,
  initialContent,
  onChange,
  error,
  charLimit,
}: {
  label: string;
  required?: boolean;
  initialContent: string;
  onChange: (html: string) => void;
  error?: string;
  charLimit?: number;
}) {
  const [length, setLength] = useState(0);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link,
      Superscript,
      SubScript,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      setLength(editor.getText().length);
      onChange(editor.getHTML());
    },
  });

  // Sync external content updates (e.g. when edit-mode jobData finishes loading)
  // once per unique incoming value, so typing doesn't trigger a reset loop.
  const lastSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editor) return;
    if (initialContent === lastSyncedRef.current) return;
    editor.commands.setContent(initialContent || '');
    // Reading length back out of ProseMirror is the only way to resync the
    // counter; setContent does not emit an update, so onUpdate will not fire.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLength(editor.getText().length);
    lastSyncedRef.current = initialContent;
  }, [editor, initialContent]);

  return (
    <div>
      <Text size="sm" mb="xs">
        <span className="font-medium">{label}</span>
        {required && <span style={{ color: 'red' }}> *</span>}
      </Text>
      <RTE editor={editor}>
        <RTE.Content />
        <RTE.Toolbar>
          <RTE.ControlsGroup>
            <RTE.Bold />
            <RTE.Italic />
            <RTE.Underline />
            <RTE.Strikethrough />
          </RTE.ControlsGroup>
          <RTE.ControlsGroup>
            <RTE.H2 />
            <RTE.H3 />
          </RTE.ControlsGroup>
          <RTE.ControlsGroup>
            <RTE.BulletList />
            <RTE.OrderedList />
          </RTE.ControlsGroup>
          <RTE.ControlsGroup>
            <RTE.Link />
            <RTE.Unlink />
          </RTE.ControlsGroup>
        </RTE.Toolbar>
      </RTE>
      <Group mt="xs">
        {error && (
          <Text color="red" size="sm">
            {error}
          </Text>
        )}
        {typeof charLimit === 'number' && (
          <Text
            size="xs"
            color={length > charLimit ? 'red' : 'gray.6'}
            ml="auto"
          >
            {length} / {charLimit}
          </Text>
        )}
      </Group>
    </div>
  );
}
