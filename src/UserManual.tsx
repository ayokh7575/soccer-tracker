import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface UserManualProps {
  onBack: () => void;
}

const flatten = (text: string, child: any): any => {
  return typeof child === 'string' || typeof child === 'number'
    ? text + child
    : React.Children.toArray(child?.props?.children).reduce(flatten, text);
};

const HeadingRenderer = ({ level, children, ...props }: any) => {
  let text = React.Children.toArray(children).reduce(flatten, '') as string;
  // Remove HTML tags if any
  text = text.replace(/<[^>]*>/g, '');
  // Remove leading numbers (e.g. "1. ")
  text = text.replace(/^\d+\.\s+/, '');
  
  const slug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]+/g, '').replace(/(^-|-$)+/g, '');
  const Tag = `h${level}` as any;
  return <Tag id={slug} {...props}>{children}</Tag>;
};

export const UserManual: React.FC<UserManualProps> = ({ onBack }) => {
  const [content, setContent] = useState('');

  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/USER_MANUAL.md`)
      .then(response => response.text())
      .then(text => setContent(text.replace(/<a\s+name="[^"]*"><\/a>/g, '')))
      .catch(err => console.error('Error loading manual:', err));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white min-h-screen">
      <button 
        onClick={onBack} 
        className="mb-4 text-blue-600 hover:underline flex items-center"
      >
        &larr; Back to App
      </button>
      
      <div className="prose prose-blue max-w-none">
        <ReactMarkdown
            components={{
                img: ({node, ...props}) => (
                    <img
                        {...props}
                        src={props.src?.startsWith('http') ? props.src : `${process.env.PUBLIC_URL}/${props.src?.replace(/^\.\//, '')}`}
                        alt={props.alt || ''}
                        className="my-4 rounded border border-gray-200 max-w-full"
                    />
                ),
                h1: (props) => <HeadingRenderer level={1} {...props} />,
                h2: (props) => <HeadingRenderer level={2} {...props} />,
                h3: (props) => <HeadingRenderer level={3} {...props} />
            }}
        >
            {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};