import React, { useEffect, useRef } from 'react';

interface ResultViewerProps {
  usercode: {
    js: string;
  };
  backendcode: {
    html: string;
  };
  activeTab: string;
}

const ngrok_url = 'https://0e5b-35-221-58-30.ngrok-free.app';
const ngrok_url_sonnet = ngrok_url + '/api/message';

const ResultViewer: React.FC<ResultViewerProps> = ({ usercode, backendcode, activeTab }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      const iframeDocument = iframe.contentDocument;

      if (iframeDocument) {
        // Clear existing content
        iframeDocument.open();
        iframeDocument.write('<!DOCTYPE html><html lang="en"><head></head><body></body></html>');
        iframeDocument.close();
        console.log('cleared', iframeDocument);

        // Create the new content
        const newDocument = iframeDocument;
        if (newDocument) {
          newDocument.open();
          if (activeTab === 'html') {
            // Render backend HTML when HTML tab is selected
            iframeDocument.write(backendcode.html);
          } 
          else if (activeTab === 'js'){
          newDocument.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Fabric.js Library Example</title>
            </head>
            <body>
                <canvas id="c"></canvas>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/1.4.0/fabric.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
                <script>
                  // Define create_canvas and make it globally accessible
                  window.create_canvas = function create_canvas(canvas_height = 600, canvas_width = 600, canvas_color) {
                    const canvas = new fabric.Canvas('c', {
                      backgroundColor: canvas_color
                    });

                    canvas.setHeight(canvas_height);
                    canvas.setWidth(canvas_width);

                    return canvas;
                  }

                  // Check if the Generate class has already been defined
                  if (!window.Generate) {
                    class Generate {
                      constructor(name) {
                        this.ngrok_url_sonnet = '${ngrok_url_sonnet}';
                        this.basic_prompt = name;
                        this.detail_prompt = '';
                        console.log('object created:', name);
                      }

                      detail(detail) {
                        this.detail_prompt = detail;
                        console.log('detail added:', detail);
                      }

                      async draw(coord, canvas, ngrok_url_sonnet = this.ngrok_url_sonnet) {
                        const APIprompt = 'write me svg code to create a ' + this.basic_prompt + ', with these details: ' + this.detail_prompt + '. Make sure donot include anything other than the svg code in your response.';
                        console.log('api prompt', APIprompt);
                        console.log(ngrok_url_sonnet);
                        try {
                          const response = await axios.post(ngrok_url_sonnet, {
                            prompt: APIprompt
                          }, {
                            headers: {
                              'Content-Type': 'application/json'
                            }
                          });

                          const data = response.data;
                          const content = data?.content;
                          console.log('content from api call:', content);

                          if (content) {
                            fabric.loadSVGFromString(content, (objects, options) => {
                              const group = fabric.util.groupSVGElements(objects, options);
                              group.set({
                                left: coord.x - group.width / 2,
                                top: coord.y - group.height / 2
                              });
                              var leftpos = coord.x - group.width / 2;
                              var toppos = coord.y - group.height / 2;

                              canvas.add(group);
                              canvas.renderAll();
                              this.generateEquivalentCode(canvas, content, leftpos, toppos);
                            });
                          }
                        } catch (error) {
                          console.error('Error drawing the shape:', error);
                        }
                      }

                      generateEquivalentCode(canvas, svgContent, leftpos, toppos) {
                        console.log('left', leftpos);
                        console.log('svg', svgContent);
                        const htmlCode = \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SVG Example</title>
    <style>
        body {
            margin: 0;
            background-color: \`+canvas.backgroundColor+\`;
            width: \`+canvas.width+\`px;
            height: \`+canvas.height+\`px;
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
        }
        svg {
            position: absolute;
            left: \`+leftpos+\`px;
            top: \`+toppos+\`px;
            /* transform: translate(-50%, -50%); Center the SVG at the coord point */
        }
    </style>
</head>
<body>\`
    +svgContent+
    \`
</body>
</html>\`;
                        console.log('Equivalent HTML code:', htmlCode);
                      }
                    }

                    // Assign the class to the global window object
                    window.Generate = Generate;
                  }

                  (function() {
                    ${usercode.js}
                  })();
                </script>
            </body>
            </html>
          `);
        }
          newDocument.close();
        }
      }
      console.log('loaded', iframeDocument);
    }
    
  }, [usercode]);

  return (
    <div className="result-viewer">
      <iframe key={JSON.stringify(usercode)} ref={iframeRef} title="Result Viewer" />
    </div>
  );
};

export default ResultViewer;
