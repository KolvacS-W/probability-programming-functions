import React, { useEffect, useRef, useState } from 'react';
import { Version, KeywordTree } from '../types';
import axios from 'axios';

interface ResultViewerProps {
  usercode: {
    js: string;
  };
  backendcode: {
    html: string;
  };
  activeTab: string;
  updateBackendHtml: (newHtml: string) => void;

  currentVersionId: string | null;
  setVersions: React.Dispatch<React.SetStateAction<Version[]>>;
  versions: Version[];

}

const ngrok_url = 'https://c2fb-34-125-1-65.ngrok-free.app';
const ngrok_url_sonnet = ngrok_url + '/api/message';
//for future use in draw()

const ResultViewer: React.FC<ResultViewerProps> = ({ usercode, backendcode, activeTab, updateBackendHtml, currentVersionId, setVersions, versions, }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  var currentreuseableElementList = versions.find(version => version.id === currentVersionId)?.reuseableElementList;
  //console.log('check svglist', currentreuseableElementList)
  const [clickCoordinates, setClickCoordinates] = useState<{ x: number; y: number } | null>(null);

  
  useEffect(() => {
    const handleIframeClick = (event: MessageEvent) => {
      if (event.data.type === 'CLICK_COORDINATES') {
        setClickCoordinates({ x: event.data.x, y: event.data.y });
        setVersions(prevVersions => {
          const updatedVersions = prevVersions.map(version =>
            version.id === currentVersionId
              ? { ...version, storedcoordinate: { x: event.data.x, y: event.data.y }}
              : version
          );
          return updatedVersions;
        });
        console.log('stored coordinates:', { x: event.data.x, y: event.data.y });
      }
    };

    window.addEventListener('message', handleIframeClick);

    return () => {
      window.removeEventListener('message', handleIframeClick);
    };
  }, []);
  
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      if (event.data.type === 'UPDATE_HTML') {
        updateBackendHtml(event.data.html); // Update the backend HTML in the React app
        console.log('backendhtml updated to app', event.data.html);
      }
  
      if (event.data.type === 'UPDATE_REUSEABLE') {
        const newElement = {
          codeName: event.data.codename,
          codeText: event.data.codetext,
          selected: false,
        };
  
        // Update the reusable element list and then check the updated list
        setVersions(prevVersions => {
          const updatedVersions = prevVersions.map(version => {
            if (version.id === currentVersionId) {
              const updatedReuseableElementList = version.reuseableElementList.map(element =>
                element.codeName === newElement.codeName ? newElement : element
              );
  
              if (!updatedReuseableElementList.some(element => element.codeName === newElement.codeName)) {
                updatedReuseableElementList.push(newElement);
              }
  
              return { ...version, reuseableElementList: updatedReuseableElementList };
            }
            return version;
          });
  
          // Now check if the `currentreuseableElementList` has been updated correctly
          const currentreuseableElementList = updatedVersions.find(version => version.id === currentVersionId)?.reuseableElementList;
  
          console.log('check currentreuseableElementList', currentreuseableElementList, updatedVersions);
  
          if (currentreuseableElementList && currentreuseableElementList.some(element => element.codeName === event.data.codename)) {
            iframeRef.current.contentWindow.postMessage(
              {
                type: 'UPDATE_REUSEABLE_CONFIRMED',
                codename: event.data.codename,
                reuseableElementList: currentreuseableElementList,
              },
              '*'
            );
            console.log(
              'posted UPDATE_REUSEABLE_CONFIRMED to iframe',
              currentreuseableElementList,
              updatedVersions.find(version => version.id === currentVersionId)?.reuseableElementList
            );
          }
  
          return updatedVersions;
        });
      }
  
      if (event.data.type === 'CODE2DESC') {
        handleCode2Desc(currentVersionId, event.data.code);
        console.log('code2desc called');
      }
    };

    const saveVersionToHistory = (currentVersionId: string) => {
      setVersions((prevVersions) => {
        const updatedVersions = prevVersions.map((version) => {
          if (version.id === currentVersionId) {
            const historyVersion = { ...version, id: `${currentVersionId}-history` };
            return { ...version, history: historyVersion };
          }
          return version;
        });
        return updatedVersions;
      });
    };

    const handleCode2Desc = async (versionId: string, code: string) => {
      saveVersionToHistory(versionId);
      if (!versionId) return;
  
      setVersions((prevVersions) => {
        const updatedVersions = prevVersions.map(version =>
          version.id === versionId
            ? { ...version, loading: true }
            : version
        );
        return updatedVersions;
      });
  
      const prompt = `Based on the following code with annotations, provide an updated description. Code:`+ code +
      `Create the description by:
      1): create a backbone description with the annotations
      2): finding important entities in the backbone description (for example, 'planet', 'shape', 'color', and 'move' are all entities) and inserting [] around them 
      3): inserting a detail wrapped in {} behind each entity according to the code (make sure to add all the details about the entity in the code, including all the variable names, numbers, specific svg path coordinates, and parameters. For example, add the number of planets and each planet's dom element type, class, style features, and name to entity 'planet').\\
      New description format:\\
      xxxxx[entity1]{detail for entity1}xxxx[entity2]{detail for entity2}... \\ 
      Important: The entities must be within the old description already instead of being newly created. Find as many entities in the old description as possible. Each entity and each detail are wrapped in a [] and {} respectively. Other than the two symbols ([], {}) and added details, the updated description should be exactly the same as the old description. Include nothing but the new description in the response.\\
      If there are svg paths or customized polygons in the code, the coordinates and points must be included in details.
      Example: 
      old description: Polygons moving and growing
      output updated description:
      [polygons]{two different polygon elements, polygon1 and polygon2 colored red and blue respectively, each defined by three points to form a triangle shape} [moving]{motion defined along path1-transparent fill and black stroke, and path2 -transparent fill and black stroke} and [growing]{size oscillates between 1 and 2 over a duration of 2000ms with easing}`;
  ;
      console.log('code2desc prompt', prompt)
  
      try {
        const response = await axios.post(ngrok_url_sonnet, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prompt: prompt })
        });
  
        const data = await response.data;
        const content = data?.content;
        console.log('content from code2text:', content);
  
        if (content) {
          const updatedDescription = content.replace('] {', ']{').replace(']\n{', ']{');
          setVersions((prevVersions) => {
            const updatedVersions = prevVersions.map(version =>
              version.id === versionId
                ? {
                    ...version,
                    description: updatedDescription,
                    savedOldDescription: updatedDescription,
                  }
                : version
            );
            return updatedVersions;
          });
        }
      } catch (error) {
        console.error("Error processing update code request:", error);
      } finally {
        setVersions((prevVersions) => {
          const updatedVersions = prevVersions.map(version =>
            version.id === versionId
              ? { ...version, loading: false }
              : version
          );
          return updatedVersions;
        });
      }
    };

    window.addEventListener('message', handleIframeMessage);
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

          // Get container dimensions for scaling
          const containerWidth = containerRef.current?.offsetWidth || 600;
          const containerHeight = containerRef.current?.offsetHeight || 600;

          if (activeTab === 'html') {
            // Render backend HTML when HTML tab is selected
            iframeDocument.write(backendcode.html);
          } else if (activeTab === 'js') {
            newDocument.write(`
              <!DOCTYPE html>
              <html lang="en">
              <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Fabric.js Library Example</title>
              </head>
              <style>
                  html, body {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    overflow: hidden;
                  }
                  #canvasContainer {
                    position: relative;
                    width: 100%;
                    height: 100%;
                  }
                </style>
              <body>
                  <div id="canvasContainer"></div>
                  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.10.0/p5.js"></script>
                  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.10.0/addons/p5.sound.min.js"></script>
                  <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
                  <script>
                  document.addEventListener('click', function(event) {
                      const rect = document.body.getBoundingClientRect();
                      const x = ((event.clientX - rect.left) / rect.width) * 100;
                      const y = ((event.clientY - rect.top) / rect.height) * 100;
                      window.parent.postMessage({ type: 'CLICK_COORDINATES', x: x, y: y }, '*');
                  });
                  </script>
                  <script>
                  function setup() {
                      // Get the canvas container element
                      let canvasContainer = document.getElementById('canvasContainer');
                                        
                      // Create the canvas with the same dimensions as the container
                      let canvas = createCanvas(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
                      
                      // Place the canvas inside the container
                      canvas.parent('canvasContainer');
                      
                      // Ensure the canvas resizes dynamically with the container
                      // window.addEventListener('resize', () => {
                      //     resizeCanvas(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
                      //     background('skyblue');  // Optional: Reapply the background to prevent any artifacts
                      // });
                    }

                  function draw() {
                    // Resize the canvas to fill the container before drawing
                    const canvasContainer = document.getElementById('canvasContainer');
                    resizeCanvas(canvasContainer.offsetWidth, canvasContainer.offsetHeight);

                  }
                  </script>
                  <script>
                  if (!window.Generate) {
                  class Generate {
    constructor(name) {
        this.ngrok_url_sonnet = '${ngrok_url_sonnet}';
        this.basic_prompt = name;
        this.detail_prompt = '';
        this.generatedSetupCode = '';
        this.generatedDrawCode = '';
        this.refcode = '';
        this.prevcode = '';
        console.log('Object created:', name);
    }
    
    refcode(codename){
    }

    prevcode(codename){
      this.prevcode = codename
    }

    detail(detail) {
        this.detail_prompt = detail;
        console.log('Detail added:', detail);
    }

    async generateCode() {
      var APIprompt = ''
      if(this.prevcode){
              const codename = this.prevcode
              const codelist = window.currentreuseableElementList
              console.log('check codelist in prev', codelist)
              const existingcode = codelist.find((item) => item.codeName === codename)?.codeText;
              console.log('draw with prev code:', existingcode)
              const APIprompt = \`fill in the draw() function for p5.js code snippet: 
              function setup() {
                // Get the canvas container element
                let canvasContainer = document.getElementById('canvasContainer');
                
                // Create the canvas with the same dimensions as the container
                let canvas = createCanvas(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
                
                // Place the canvas inside the container
                canvas.parent('canvasContainer');                
              }
              function draw() {\`
              +existingcode+
              \`}
          to add a\` + this.basic_prompt+ \`, with these details: \` + this.detail_prompt +\` on canvas. Make sure to include no text other than code inside draw() function in the response. Also donot include "draw() {} in response, just the code inside. Make sure the background color for the code you added are all transparent.\`;
          }

      else {
                  APIprompt = \`fill in the draw() function for p5.js code snippet: 
                  function setup() {
                      // Get the canvas container element
                      let canvasContainer = document.getElementById('canvasContainer');
                      
                      // Create the canvas with the same dimensions as the container
                      let canvas = createCanvas(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
                      
                      // Place the canvas inside the container
                      canvas.parent('canvasContainer');
                  }
                  function draw() {
                  }
              to add a\` + this.basic_prompt+ \`, with these details: \` + this.detail_prompt +\` on canvas. Make sure to include no text other than code inside draw() function in the response. Also donot include "draw() {} in response, just the code inside. Make sure the background color for the code you added are all transparent.\`;                    
      }
       console.log('API prompt:', APIprompt);

          try {
            const response = await axios.post(this.ngrok_url_sonnet, {
              prompt: APIprompt
            }, {
              headers: {
                'Content-Type': 'application/json'
              }
            });

            const data = response.data;
            const content = data?.content;
            console.log('Content from API call:', content);

            if (content) {
                this.generatedDrawCode = content;
            }
        } catch (error) {
            console.error('Error generating p5.js code:', error);
        }
    }

    async apply() {
        if (this.generatedDrawCode) {
            // Preserve the existing draw function
            const existingDrawFunction = window.draw || function() {};

            // Create a new function from the generated draw code
            const newDrawFunction = new Function(this.generatedDrawCode);

            // Define the combined draw function
            window.draw = function() {
                existingDrawFunction();
                newDrawFunction();
            };

            const codename = this.basic_prompt + ' ' + this.detail_prompt;
          // Send the message to update the reusable element list
          window.parent.postMessage({ type: 'UPDATE_REUSEABLE', codename: codename, codetext: this.generatedDrawCode }, '*');
          console.log('Sent UPDATE_REUSEABLE message with codename:', codename);

          // Wait for the confirmation after sending the message
          await new Promise((resolve) => {
              const messageHandler = (event) => {
                  if (event.data.type === 'UPDATE_REUSEABLE_CONFIRMED' && event.data.codename === codename) {
                      window.currentreuseableElementList = event.data.reuseableElementList;
                      console.log('Received UPDATE_REUSEABLE_CONFIRMED for codename:', window.currentreuseableElementList);
                      window.removeEventListener('message', messageHandler);
                      resolve(); // Resolve the promise to continue execution
                  }
              };
              window.addEventListener('message', messageHandler);
          });
            console.log('Draw function applied.', window.draw, codename);
            return codename; // Return the codename
        } else {
            console.error('No generated draw code available to apply.');
        }
    }

    async generateAndApply() {
        await this.generateCode();
        const codename = await this.apply();
        return codename;
    }
}

                  // Assign the class to the global window object
                      window.Generate = Generate;
                  }
                    (function() {
                      // Automatically wrap the user code in an async function
                      (async function() {
                        ${usercode.js}
                      })();
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

    return () => {
      window.removeEventListener('message', handleIframeMessage);
    };
  }, [usercode]);

  return (
    <div ref={containerRef} className="result-viewer" >
      <iframe key={JSON.stringify(usercode)} ref={iframeRef} title="Result Viewer" style={{ width: '100%', height: '100%' }}/>
    </div>
  );
};

export default ResultViewer;
