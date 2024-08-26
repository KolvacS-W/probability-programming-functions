// Import necessary libraries and types
import React, { useEffect } from 'react';
import ReactLoading from 'react-loading';
import ContentEditable from './ContentEditable';
import { Version, KeywordTree } from '../types';
import { useState } from 'react';
import Anthropic from "@anthropic-ai/sdk";
import axios from 'axios';


const API_KEY = '??';
// const anthropic = new Anthropic({ apiKey: '' });

const ngrok_url = 'https://0e5b-35-221-58-30.ngrok-free.app';
const ngrok_url_sonnet = ngrok_url+'/api/message';
const ngrok_url_haiku = ngrok_url+'/api/message-haiku';


interface DescriptionEditorProps {
  onApply: (description: string) => void;
  savedOldCode: { html: string; css: string; js: string };
  onWordSelected: (word: string) => void;
  currentVersionId: string | null;
  versions: Version[];
  setVersions: React.Dispatch<React.SetStateAction<Version[]>>;
  extractKeywords: (description: string) => KeywordTree[];
}



const DescriptionEditor: React.FC<DescriptionEditorProps> = ({
  onApply,
  savedOldCode,
  onWordSelected,
  currentVersionId,
  versions,
  setVersions,
  extractKeywords,
}) => {
  const version = versions.find(version => version.id === currentVersionId);
  const loading = version ? version.loading : false;

  //update latestDescriptionText whenever description changes
  useEffect(() => {
    const currentDescription = versions.find(version => version.id === currentVersionId)?.description || '';
    setVersions((prevVersions) => {
      const updatedVersions = prevVersions.map(version =>
        version.id === currentVersionId
          ? { ...version, latestDescriptionText: currentDescription }
          : version
      );
      return updatedVersions;
    });
  }, [versions.find(version => version.id === currentVersionId)?.description]);


  //save the last state of current version when it updates
  const saveVersionToHistory = (currentVersionId: string) => {
    setVersions(prevVersions => {
      const updatedVersions = prevVersions.map(version => {
        if (version.id === currentVersionId) {
          const historyVersion = { ...version, id: `${currentVersionId}-history` };
          return { ...version, history: historyVersion };
        }
        return version;
      });
      return updatedVersions;
    });
  };
  

  const handleParseDescription = async (versionId: string) => {
    saveVersionToHistory(versionId);
    setVersions(prevVersions => {
      const updatedVersions = prevVersions.map(version =>
        version.id === versionId
          ? { ...version, loading: true }
          : version
      );
      return updatedVersions;
    });

    const detailtargetext = version?.detailtargetext || ''; // Added
  
    const prompt = `Given a description of an anime.js animation program and a target (about any specific parts of the description, like objects, features or animations), 
                    Find all the text pieces in the description that are specific code details (e.g., variable name, parameters, size, number, path, coordinates) related to the target.
                    Return a list of the found text pieces. make sure the returned text pieces are exactly from the description. Splift the text pieces with ///.
                    Example:
                    description:
                    A [cottage] {rect element with x: 50, y: 80, width: 100, height: 60, filled in white} perched on 
                    a [green mountain] {path element shaped to create a mountainous outline with coordinates "M0 140 L50 100 L100 140 L150 90 L200 140 L200 200 L0 200 Z", filled in #006400} under 
                    a [sky-blue background] {rect element covering the entire SVG's upper area with width="100%" and height="200", fill="#87CEEB"}.
                    target: cottage
                    response:
                    ///
                    with x: 50, y: 80, width: 100, height: 60, filled in white
                    ///

                    target: shape of objects
                    response:
                    ///
                    with coordinates "M0 140 L50 100 L100 140 L150 90 L200 140 L200 200 L0 200 Z"
                    ///
                     with width="100%" and height="200"
                    ///

                    target: color of objects
                    response:
                    filled in white
                    ///
                    filled in #006400
                    ///
                    fill="#87CEEB"
                    Return nothing but only the text pieces and ///.
                    Return pieces from this description: ${version?.description} and target: `+detailtargetext;
    try {
      // const response = await fetch("https://api.openai.com/v1/chat/completions", {
      //   method: "POST",
      //   headers: {
      //     "Authorization": `Bearer ${API_KEY}`,
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     model: "gpt-4-turbo",
      //     messages: [{ role: "system", content: "You are a creative programmer." }, { role: "user", content: prompt }],
      //   }),
      // });
      // const content = response?.choices[0]?.message?.content;
      const response = await axios.post(ngrok_url_sonnet, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: prompt })
      });
  
      const data = await response.data;
      const content = data?.content;
      console.log('content from Parsedescription:', content);
  
      if (content) {
        const specificParamList = content.split('///').map((param: string) => param.trim());
        setVersions(prevVersions => {
          const updatedVersions = prevVersions.map(version =>
            version.id === versionId
              ? { ...version, specificParamList }
              : version
          );
          return updatedVersions;
        });
      }
    } catch (error) {
      console.error("Error processing request:", error);
    } finally {
      console.log('check version after parsedescription', versions)
      setVersions(prevVersions => {
        const updatedVersions = prevVersions.map(version =>
          version.id === versionId
            ? { ...version, loading: false }
            : version
        );
        return updatedVersions;
      });
    }
  };
  
  const handleSpecificParamRightClick = (text: string) => {
    if (!currentVersionId) return;
    const currentDescription = versions.find(version => version.id === currentVersionId)?.description || '';
    const updatedDescription = currentDescription.replace(text, '');
    setVersions(prevVersions => {
      const updatedVersions = prevVersions.map(version =>
        version.id === currentVersionId
          ? {
              ...version,
              description: updatedDescription.replace('] {', ']{').replace(']\n{', ']{'),
              specificParamList: version.specificParamList.filter(param => param !== text)
            }
          : version
      );
      return updatedVersions;
    });
    console.log('description updated by handleSpecificParamRightClick', versions)
  };
  
  
  
  // functions for GPT calls. for async functions, versionId must be passed as a parameter to keep track of the right version
  const handleInitialize = async (versionId: string) => {
    saveVersionToHistory(versionId);
    setVersions(prevVersions => {
      const updatedVersions = prevVersions.map(version =>
        version.id === versionId
          ? { ...version, loading: true }
          : version
      );
      return updatedVersions;
    });

    const selectedElementcodeName = version?.reuseableElementList.filter(element => element.selected).map(element => element.codeName).join('\n') || '';
    const selectedElementcodeText = version?.reuseableElementList.filter(element => element.selected).map(element => element.codeText).join('\n') || '';

    let prompt = `Create an animation using anime.js based on the given instruction. 
    Make the result animation on a square page that can fit and center on any page.
    Use svg shapes or customized polygons by defining points to create objects, and use svg path to create routes for the position movement of objects. 
    create all the objects or paths in html instead of in script.
    Don't use any external elements like images or svg, create everything with code.\\
    Make sure to implement as many details from the description as possible. e.g., include elements (e.g., eyes, windows) of objects (e.g., fish, house), the features (e.g., shape, color) and the changes (e.g., movement, size, color)).
    Donnot move the position of objects if there's no required position movement in instruction (e.g., growing big/tall and rotating should not involve position movement), and use transform-origin to prevent unexpected position change caused by animation.
    you can refer to the following code snippet for: Apples growing on a tree on a hill
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Apples Growing on a Tree</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>
        <style>
            body, html {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                background-color: #87CEEB;
            }
            #animation-container {
                width: 400px;
                height: 400px;
                position: relative;
                overflow: hidden;
            }
            .hill {
                fill: #4CAF50;
            }
            .tree-trunk {
                fill: #8B4513;
            }
            .tree-leaves {
                fill: #228B22;
            }
            .apple {
                fill: #FF0000;
            }
        </style>
    </head>
    <body>
        <div id="animation-container">
            <svg width="100%" height="100%" viewBox="0 0 400 400">
                <path class="hill" d="M0 400 Q200 200 400 400 Z" />
                <rect class="tree-trunk" x="180" y="200" width="40" height="150" />
                <path class="tree-leaves" d="M200 50 Q130 120 100 200 Q200 150 300 200 Q270 120 200 50 Z" />
                <circle class="apple" cx="150" cy="150" r="0" />
                <circle class="apple" cx="250" cy="150" r="0" />
                <circle class="apple" cx="180" cy="220" r="0" />
                <circle class="apple" cx="220" cy="220" r="0" />
            </svg>
        </div>

        <script>
            anime({
                targets: '.tree-leaves',
                scale: [1, 1.05, 1],
                duration: 3000,
                easing: 'easeInOutQuad',
                loop: true
            });

            anime({
                targets: '.apple',
                r: 15,
                duration: 3000,
                delay: anime.stagger(500),
                easing: 'easeOutElastic(1, .5)'
            });
        </script>
    </body>
    </html>

    Try to include css and javascript code in html.
    Return response in this format: (Code:  \`\`\`html html code \`\`\`html, \`\`\`js javascript code, leave blank if none \`\`\`js, \`\`\`css css code, leave blank if none \`\`\`css; Explanation: explanations of the code). Instruction: ${version?.description}`;
    
    if (selectedElementcodeName != ''){
      prompt += `\n The following code pieces about `+selectedElementcodeName + `is already written for you, use them: `+selectedElementcodeText
    }
    console.log(prompt)
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
        console.log('content from handleInitialize:', content);
        if (content) {
          const textResponse = content;
          console.log('Response from handleInitialize:', textResponse);
          const newCode = parseGPTResponse(textResponse);
          setVersions(prevVersions => {
            const updatedVersions = prevVersions.map(version =>
              version.id === versionId
                ? { ...version, code: newCode, savedOldCode: newCode }
                : version
            );
            return updatedVersions;
          });
          await handleSecondGPTCall(newCode, version?.description || '', versionId);
        }
    }
    catch (error) {
      console.error("Error processing request:", error);
    } finally {
      setVersions(prevVersions => {
        const updatedVersions = prevVersions.map(version =>
          version.id === versionId
            ? { ...version, loading: false }
            : version
        );
        return updatedVersions;
      });
      console.log('check versions after handlesecondgptcall', versions)
    }
  };

  const handleSecondGPTCall = async (newCode: { html: string; css: string; js: string }, existingDescription: string, versionId: string) => {
    const newPrompt = `Based on the following code and description, provide an updated description. Code: HTML: \`\`\`html${newCode.html}\`\`\` CSS: \`\`\`css${newCode.css}\`\`\` JS: \`\`\`js${newCode.js}\`\`\` Description: ${existingDescription}. create the updated description by 
    1): finding important entities in the old description (for example, 'planet', 'shape', 'color', and 'move' are all entities) and inserting [] around them 
    2): inserting a detail wrapped in {} behind each entity according to the code (make sure to add all the details about the entity in the code, including all the variable names, numbers, specific svg path coordinates, and parameters. For example, add the number of planets and each planet's dom element type, class, style features, and name to entity 'planet').\\
    New description format:\\
    xxxxx[entity1]{detail for entity1}xxxx[entity2]{detail for entity2}... \\ 
    Important: The entities must be within the old description already instead of being newly created. Find as many entities in the old description as possible. Each entity and each detail are wrapped in a [] and {} respectively. Other than the two symbols ([], {}) and added details, the updated description should be exactly the same as the old description. Include nothing but the new description in the response.\\
    If there are svg paths or customized polygons in the code, the coordinates and points must be included in details.
    Example: 
    old description: Polygons moving and growing
    output updated description:
    [polygons]{two different polygon elements, polygon1 and polygon2 colored red and blue respectively, each defined by three points to form a triangle shape} [moving]{motion defined along path1-transparent fill and black stroke, and path2 -transparent fill and black stroke} and [growing]{size oscillates between 1 and 2 over a duration of 2000ms with easing}`;

    try {
      const response = await axios.post(ngrok_url_sonnet, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: newPrompt })
      });
  
    const data = await response.data;
    const content = data?.content;
    console.log('content from handleSecondGPTcall:', content);

      if (content) {
        const updatedDescription = content.replace('] {', ']{').replace(']\n{', ']{');
        setVersions(prevVersions => {
          const updatedVersions = prevVersions.map(version =>
            version.id === versionId
              ? {
                  ...version,
                  description: updatedDescription,
                  savedOldDescription: updatedDescription,
                  keywordTree: extractKeywords(updatedDescription),
                }
              : version
          );
          return updatedVersions;
        });
      }
    } catch (error) {
      console.error("Error processing second request:", error);
    }
  };

  const updateDescriptionGPTCall = async (versionId: string) => {
    saveVersionToHistory(versionId);
    setVersions(prevVersions => {
      const updatedVersions = prevVersions.map(version =>
        version.id === versionId
          ? { ...version, loading: true }
          : version
      );
      return updatedVersions;
    });

    const selectedElementcodeName = version?.reuseableElementList.filter(element => element.selected).map(element => element.codeName).join('\n') || '';
    const selectedElementcodeText = version?.reuseableElementList.filter(element => element.selected).map(element => element.codeText).join('\n') || '';

    let prompt = `Based on the following old code and its old description, I am showing you an updated description and you will provide an updated code. \\
    Old code: HTML: \`\`\`html${savedOldCode.html}\`\`\` CSS: \`\`\`css${savedOldCode.css}\`\`\` JS: \`\`\`js${savedOldCode.js}\`\`\` \\
    Old Description: ${versions.find(version => version.id === versionId)?.savedOldDescription}. \\
    New description: ${version?.description}. \\
    In the description, words in [] are important entities that must be created by code, and the following entities are detailed hints in {} to specify how to create these entities and animations with code by specifying.
    Still, use anime.js and use customizable svg paths for object movement. You can refer to the old code to see example methods and code formats and refine it according to the new description.\\
    Don't use any external elements like images or svg, create everything with code.\\
    Try to include css and javascript code in html like the old code.\\
    Make sure to modify as little code as possible, keep as many original objects and structures as possible, and only change the necessary parts that is updated by the new description.\\
    Unless changed in description, don't change html and body Styles or svg styles in the <style> tag.\\
    Include updated code and the explanation of what changed in the updated description, and why your change in the code can match this description change, and how your change didn't affect the existing code pieces or CSS Styles that remains the same according to the description.\\
    Return response in this format: (Code:  \`\`\`html html code \`\`\`html, \`\`\`js javascript code, leave blank if none \`\`\`js, \`\`\`css css code, leave blank if none \`\`\`css; Explanation: explanation content)`;
     
    if (selectedElementcodeName != ''){
      prompt += `\n Donnot change the following code pieces about `+selectedElementcodeName + ` : `+selectedElementcodeText
    }
    
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
    console.log('content from handleupdatedescription:', content);
      if (content) {
        console.log('prompt for update description', prompt)
        console.log('response after update description', content)
        const newCode = parseGPTResponse(content);
        setVersions(prevVersions => {
          const updatedVersions = prevVersions.map(version =>
            version.id === versionId
              ? { ...version, code: newCode, savedOldCode: newCode }
              : version
          );
          return updatedVersions;
        });
        await GPTCallAfterupdateDescription(newCode, version?.description || '', versionId);
      }
    } catch (error) {
      console.error("Error processing update description request:", error);
    } finally {
      setVersions(prevVersions => {
        const updatedVersions = prevVersions.map(version =>
          version.id === versionId
            ? { ...version, loading: false }
            : version
        );
        return updatedVersions;
      });
    }
  };

  const GPTCallAfterupdateDescription = async (newCode: { html: string; css: string; js: string }, existingDescription: string, versionId: string) => {
    const newPrompt = `Slightly refine the given description for the code, to make it fit the code better. Code: HTML: \`\`\`html${newCode.html}\`\`\` CSS: \`\`\`css${newCode.css}\`\`\` JS: \`\`\`js${newCode.js}\`\`\` Description: ${existingDescription}.\\
    New description format:\\
    xxxxx[entity1]{detail for entity1}xxxx[entity2]{detail for entity2}... \\ 
    In [] are important entities for the animation, and in {} behind each entity are all the details about the corresponding entity in the code, including all the variable names, numbers, specific path coordinates, and parameters. 
    Important: One [] only contains one entity and one {} only contains one detail. Each entity and each detail are wrapped in a [] and {} respectively. Include nothing but the new description in the response.\\
    Example description:
    [fishes]{#fish1 and #fish2, orange-colored, marine creatures depicted using polygonal SVG elements} shaped as [complex polygons]{polygonal shapes simulating the bodily form of fish with points configured in specific coordinates} are [swimming]{both #fish1 and #fish2 are animated to dynamically move along their designated paths:#path1 and #path2, predefined SVG paths depicted as smooth wavy lines} across an [ocean]{visualized by a large rectangular area filled with a vertical blue gradient, representing water}\\
    Just as with the old description, make sure it is made of coherent sentences with words other than entities and details.\\
    Try to keep the updated description as close to the old description as possible, only change necessary parts to fit the code better.\\
    Include only the updated description in the response.`;
    try {
      // const response = await fetch("https://api.openai.com/v1/chat/completions", {
      //   method: "POST",
      //   headers: {
      //     "Authorization": `Bearer ${API_KEY}`,
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     model: "gpt-4-turbo",
      //     messages: [{ role: "system", content: "You are a creative programmer." }, { role: "user", content: newPrompt }],
      //   }),
      // });

      // const data = await response.json();
      // const newDescriptionContent = data.choices[0]?.message?.content;
      const response = await axios.post(ngrok_url_sonnet, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: newPrompt })
      });
  
    const data = await response.data;
    const content = data?.content;
    console.log('content from gotcallafterupdatedescription:', content);

      if (content) {
        const updatedDescription = content.replace('] {', ']{').replace(']\n{', ']{');
        setVersions(prevVersions => {
          const updatedVersions = prevVersions.map(version =>
            version.id === versionId
              ? {
                  ...version,
                  description: updatedDescription,
                  savedOldDescription: updatedDescription,
                  keywordTree: extractKeywords(updatedDescription),
                }
              : version
          );
          return updatedVersions;
        });
      }
    } catch (error) {
      console.error("Error processing second request:", error);
    }
  };

  const handleExtend = async (versionId: string) => {
    setVersions(prevVersions => {
      const updatedVersions = prevVersions.map(version =>
        version.id === versionId
          ? { ...version, loading: true }
          : version
      );
      return updatedVersions;
    });

    const baseVersionName = versionId;

    try {
      const prompt = `Help me extend a prompt and add more details. The prompt is for creating animations with anime.js. 
      Extend the original prompt, to make it more expressive with more details that suit the prompt description and also give clearer instructions as to what the animation code should be (e.g., tell in detail elements (e.g., eyes, windows) of objects (e.g., fish, house), the features (e.g., shape, color) and the changes (e.g., movement, size, color) as well as how they are made in animation code).
      Just add details and descriptions without changing the sentence structure.\\
      return 4 extended prompts in the response (divided by ///), and only return these extended. prompts in the response.
      Make the extended prompt as simple as possible. Do not add too many subjective modifiers and contents irrelevant to the original prompt.
      Example:
      Original prompt:
      A fish swimming in the ocean

      response:
      a blue fish with large eyes and flowing fins swimming straight into the blue ocean.
      ///
      a fish with intricate scales, a bright orange body, and a curved tail swimming in waving paths in the dark blue ocean.
      ///
      a tropical fish with vibrant stripes of yellow, green, and red with a streamlined body and sharp, pointed fins swimming slowly in the blue ocean.
      ///
      a fish with a round body, whimsical patterns on its scales with small black eyes swimming from left to right in the waving ocean.

      Extend this prompt: ${version?.description}`;

      // const response = await fetch("https://api.openai.com/v1/chat/completions", {
      //   method: "POST",
      //   headers: {
      //     "Authorization": `Bearer ${API_KEY}`,
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     model: "gpt-3.5-turbo",
      //     messages: [
      //       { role: "system", content: "You are a creative programmer." },
      //       { role: "user", content: prompt },
      //     ],
      //   }),
      // });

      // const data = await response.json();
      // const newDescriptionContent = data.choices[0]?.message?.content;

      const response = await axios.post(ngrok_url_haiku, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: prompt })
      });
  
      const data = await response.data;
      const content = data?.content;
      console.log('content from handleExtend:', content);

      if (content) {
        const newDescriptions = content.split('///');
        setVersions(prevVersions => {
          const updatedVersions = [...prevVersions];
          newDescriptions.forEach((desc: string, index: number) => {
            updatedVersions.push({
              id: `${baseVersionName} extended ${index + 1}`,
              description: desc.trim(),
              savedOldDescription: '',
              code: { html: '', css: '', js: '' },
              savedOldCode: { html: '', css: '', js: '' },
              keywordTree: extractKeywords(desc),
              wordselected: 'ocean',
              highlightEnabled: false,
              loading: false,
              piecesToHighlightLevel1: [],
              piecesToHighlightLevel2: [],
              showDetails: {},
              latestDescriptionText: desc.trim(),
              hiddenInfo: [],
              formatDescriptionHtml:'',
              specificParamList: [], // Added
              paramCheckEnabled: false, // Added
              reuseableElementList: [], // Added
            });
          });
          return updatedVersions;
        });
      }
    } catch (error) {
      console.error("Error processing extend request:", error);
    } finally {
      setVersions(prevVersions => {
        const updatedVersions = prevVersions.map(version =>
          version.id === versionId
            ? { ...version, loading: false }
            : version
        );
        return updatedVersions;
      });
    }
  };

  const parseGPTResponse = (response: string): { html: string; css: string; js: string } => {
    const htmlMatch = response.match(/```html([\s\S]*?)```/);
    const cssMatch = response.match(/```css([\s\S]*?)```/);
    const jsMatch = response.match(/```js([\\s\S]*?)```/);

    const html = htmlMatch ? htmlMatch[1].trim() : '';
    const css = cssMatch ? cssMatch[1].trim() : '';
    const js = jsMatch ? jsMatch[1].trim() : '';

    return { html, css, js };
  };


  //functions for contenteditable props: handle user interaction for formatted description 
  const toggleDetails = (word: string) => {
    if (!currentVersionId) return;
    setVersions(prevVersions => {
      const updatedVersions = prevVersions.map(version =>
        version.id === currentVersionId
          ? {
              ...version,
              showDetails: { ...version.showDetails, [word]: !version.showDetails[word] },
              description: version.latestDescriptionText.replace('] {', ']{').replace(']\n{', ']{'),
            }
          : version
      );
      return updatedVersions;
    });
  };
  
  const handleTextChange = (html: string) => {
    if (!currentVersionId) return;
    const extractText = (node: ChildNode): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const word = element.getAttribute('data-word');
        if (word) {
          const detailsElement = element.querySelector('span[style="color: orange;"]');
          const details = detailsElement ? detailsElement.textContent : '';
          return `[${word}]${details ? ` {${details}}` : ''}`;
        }
        return Array.from(node.childNodes).map(extractText).join('');
      }
      return '';
    };
  
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let text = Array.from(doc.body.childNodes)
      .map(extractText)
      .join('')
      .replace(/\s+/g, ' ')
      .replace('\n', ' ')
      .replace('] {', ']{').replace(']\n{', ']{')
      .trim();
  
    setVersions(prevVersions => {
      const updatedVersions = prevVersions.map(version =>
        version.id === currentVersionId
          ? {
              ...version,
              latestDescriptionText: text.replace('] {', ']{').replace(']\n{', ']{'),
            }
          : version
      );
      return updatedVersions;
    });
  };
  
  const handleTabPress = (value: string) => {
    // if (!currentVersionId) return;
    // const extractText = (node: ChildNode): string => {
    //   if (node.nodeType === Node.TEXT_NODE) {
    //     return node.textContent || '';
    //   } else if (node.nodeType === Node.ELEMENT_NODE) {
    //     const element = node as HTMLElement;
    //     const word = element.getAttribute('data-word');
    //     if (word) {
    //       const detailsElement = element.querySelector('span[style="color: orange;"]');
    //       const details = detailsElement ? detailsElement.textContent : '';
    //       return `[${word}]${details ? ` {${details}}` : ''}`;
    //     }
    //     return Array.from(node.childNodes).map(extractText).join('');
    //   }
    //   return '';
    // };
  
    // const doc = new DOMParser().parseFromString(value, 'text/html');
    // let text = Array.from(doc.body.childNodes)
    //   .map(extractText)
    //   .join('')
    //   .replace(/\s+/g, ' ')
    //   .replace('\n', ' ')
    //   .replace('] {', ']{').replace(']\n{', ']{')
    //   .trim();
  
    // setVersions(prevVersions => {
    //   const updatedVersions = prevVersions.map(version =>
    //     version.id === currentVersionId
    //       ? {
    //           ...version,
    //           description: text.replace('] {', ']{').replace(']\n{', ']{'),
    //         }
    //       : version
    //   );
    //   return updatedVersions;
    // });
    // onApply(text.replace('] {', ']{').replace(']\n{', ']{'));
    if (!currentVersionId) return;
    setVersions(prevVersions => {
      const updatedVersions = prevVersions.map(version =>
        version.id === currentVersionId
          ? {
              ...version,
              description: version.latestDescriptionText.replace('] {', ']{').replace(']\n{', ']{'),
            }
          : version
      );
      return updatedVersions;
    });
  };
  
  const handleDoubleClick = (word: string) => {
    const processedWord = unpluralize(uncapitalize(word.trim()));
    console.log('double click', processedWord)
    onWordSelected(processedWord);
  };
  
  // Dummy implementations of uncapitalize and unpluralize for demonstration purposes
  function uncapitalize(word: string): string {
    return word.charAt(0).toLowerCase() + word.slice(1);
  }
  
  function unpluralize(word: string): string {
    return word.endsWith('s') ? word.slice(0, -1) : word;
  }

  const handleUndo = () => {
    if (!currentVersionId) return;
    
    setVersions(prevVersions => {
      const updatedVersions = prevVersions.map(version => {
        if (version.id === currentVersionId && version.history) {
          return { ...version.history, id: currentVersionId };
        }
        console.log('undo, but this version has no history yet')
        return version;
      }).filter(version => !version.id.endsWith('-history'));
      return updatedVersions;
    });
  };
  
  return (
    <div className="description-editor">
      <div className="content-editable-container">
        <ContentEditable
          value={version?.description || ''}
          onChange={handleTextChange}
          onRightClick={toggleDetails}
          onTabPress={handleTabPress}
          currentVersionId={currentVersionId}
          onDoubleClick={handleDoubleClick}
          versions={versions}
          setVersions={setVersions}
          paramCheckEnabled={version?.paramCheckEnabled || false}
          specificParamList={version?.specificParamList || []}
          onSpecificParamRightClick={handleSpecificParamRightClick}
        />
      </div>
      {/* <textarea
        value={version?.description || ''}
        onChange={(e) => {
          if (!currentVersionId) return;
          setVersions(prevVersions => {
            const updatedVersions = prevVersions.map(version =>
              version.id === currentVersionId
                ? { ...version, description: e.target.value.replace('] {', ']{').replace(']\n{', ']{') }
                : version
            );
            return updatedVersions;
          });
        }}
        placeholder="Enter description here"
      /> */}
      <textarea
        value={version?.detailtargetext || ''} // Added
        onChange={(e) => {
          if (!currentVersionId) return;
          setVersions(prevVersions => {
            const updatedVersions = prevVersions.map(version =>
              version.id === currentVersionId
                ? { ...version, detailtargetext: e.target.value }
                : version
            );
            return updatedVersions;
          });
        }}
        placeholder="" // Added
      />
      {/* <div className="button-group">
        <button className="purple-button" onClick={() => handleExtend(currentVersionId || '')}>Extend</button>
        <button className="purple-button" onClick={() => handleInitialize(currentVersionId || '')}>Initialize</button>
        <button className="purple-button" onClick={() => updateDescriptionGPTCall(currentVersionId || '')}>Update</button>
      </div>
      <div className="button-group">
        <button className="blue-button" onClick={() => handleParseDescription(currentVersionId || '')}>Parse Description</button>
        <button className="green-button" onClick={() => {
          setVersions(prevVersions => {
            const updatedVersions = prevVersions.map(version =>
              version.id === currentVersionId
                ? { ...version, paramCheckEnabled: !version.paramCheckEnabled }
                : version
            );
            return updatedVersions;
          });
        }}>
          {version?.paramCheckEnabled ? 'Disable Param Check' : 'Enable Param Check'}
        </button>
        <button className="red-button" onClick={handleUndo}>Undo</button>
      </div> */}
      {loading && (
        <div className="loading-container">
          <ReactLoading type="spin" color="#007bff" height={50} width={50} />
        </div>
      )}
    </div>
  );
  
  
};

export default DescriptionEditor;
