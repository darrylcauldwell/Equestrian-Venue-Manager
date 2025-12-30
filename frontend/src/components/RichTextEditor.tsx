import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter content...',
  readOnly = false,
  minHeight = '300px',
}) => {
  const modules = useMemo(() => ({
    toolbar: readOnly ? false : [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub' }, { 'script': 'super' }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'indent': '-1' }, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['blockquote'],
      ['link'],
      ['clean'],
    ],
  }), [readOnly]);

  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'list', 'bullet', 'indent',
    'align',
    'blockquote',
    'link',
  ];

  return (
    <div className="rich-text-editor" style={{ minHeight }}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly}
        style={{ height: `calc(${minHeight} - 42px)` }}
      />
      <style>{`
        .rich-text-editor .ql-container {
          font-size: 14px;
          font-family: inherit;
        }
        .rich-text-editor .ql-editor {
          min-height: calc(${minHeight} - 84px);
        }
        .rich-text-editor .ql-toolbar {
          background: #f8f9fa;
          border-top-left-radius: 4px;
          border-top-right-radius: 4px;
        }
        .rich-text-editor .ql-container {
          border-bottom-left-radius: 4px;
          border-bottom-right-radius: 4px;
        }
        .rich-text-editor .ql-editor.ql-blank::before {
          font-style: normal;
          color: #999;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
