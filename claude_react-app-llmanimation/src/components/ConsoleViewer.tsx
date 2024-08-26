import React from 'react';

interface ConsoleViewerProps {
  logs: string[];
}

const ConsoleViewer: React.FC<ConsoleViewerProps> = ({ logs }) => {
  return (
    <div className="console-viewer">
      <h2>Console Output</h2>
      <div className="console-logs">
        {logs.map((log, index) => (
          <div key={index} className="console-log">
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConsoleViewer;
