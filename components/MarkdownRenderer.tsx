
import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const formatText = (text: string) => {
    // Basic regex-based formatting for bold, italics, and inline code
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded font-mono text-sm">$1</code>');
    
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  const renderContent = (text: string) => {
    // Split by code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const lines = part.split('\n');
        const lang = lines[0].replace('```', '').trim();
        const code = lines.slice(1, -1).join('\n');
        return (
          <div key={index} className="relative group my-6">
            <div className="absolute top-0 right-0 px-3 py-1 text-[10px] text-gray-500 font-black uppercase tracking-widest bg-white/5 rounded-bl-xl border-b border-l border-white/5">
              {lang || 'code'}
            </div>
            <pre className="p-5 bg-black/40 rounded-2xl border border-white/10 overflow-x-auto text-sm leading-relaxed text-blue-100 font-mono">
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      
      // Handle normal paragraphs and lists
      return part.split('\n').map((line, lineIdx) => {
        if (!line.trim()) return <div key={lineIdx} className="h-4" />;
        
        // Bullet points
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          return (
            <div key={lineIdx} className="flex gap-3 mb-2 ml-4">
              <span className="text-blue-500 mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
              <p className="text-gray-200 leading-relaxed text-[15px] flex-1">
                {formatText(line.trim().substring(2))}
              </p>
            </div>
          );
        }

        return (
          <p key={lineIdx} className="mb-4 text-gray-200 leading-relaxed text-[15px] font-medium">
            {formatText(line)}
          </p>
        );
      });
    });
  };

  return <div className="markdown-content">{renderContent(content)}</div>;
};

export default MarkdownRenderer;
