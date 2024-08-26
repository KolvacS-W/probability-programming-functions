import React, { useState } from 'react';
import axios from 'axios';
import { Version } from '../types';

interface ReusableElementToolbarProps {
  currentVersionId: string | null;
  versions: Version[];
  setVersions: React.Dispatch<React.SetStateAction<Version[]>>;
  hoveredElement: string | null;
  setHoveredElement: React.Dispatch<React.SetStateAction<string | null>>;
}

const ngrok_url = 'https://5c75-34-44-206-208.ngrok-free.app';
const ngrok_url_sonnet = ngrok_url + '/api/message';

const ReusableElementToolbar: React.FC<ReusableElementToolbarProps> = ({
  currentVersionId,
  versions,
  setVersions,
  hoveredElement,
  setHoveredElement,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isMouseOver, setIsMouseOver] = useState(false);
  const version = versions.find(version => version.id === currentVersionId);
  const loading = version ? version.loading : false;

  const handleDeleteReusableElement = (versionId: string, codeName: string) => {
    setVersions(prevVersions => {
      const updatedVersions = prevVersions.map(version =>
        version.id === versionId
          ? { ...version, reuseableElementList: version.reuseableElementList.filter(element => element.codeName !== codeName) }
          : version
      );
      return updatedVersions;
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleAddElement = async (versionId: string) => {
    if (!currentVersionId) return; // Ensure currentVersionId is not null
    setVersions(prevVersions => {
      const updatedVersions = prevVersions.map(version =>
        version.id === versionId
          ? { ...version, loading: true }
          : version
      );
      return updatedVersions;
    });
    try {
      const prompt = `read the following code for anime.js animation, and a description, find all the code pieces that is relevant to the elements of that description. 
      The description will be in format of object + feature. There are 3 types of features: shape (html elements), color, and movement (anime.js script). The code pieces need to be precisely related to one or multiple features according to the description.
      Code: ${versions.find(version => version.id === versionId)?.code.html} , description:` + inputValue +`
      Respond to this format and don't include anything else in response:
      object: ......
      feature: ......
      code piece: ...... Only return the features the description is talking about. If there's no code piece for the object + feature of the description, return empty for code piece`;
      console.log('prompt for handleAddElement:', prompt);
      const response = await axios.post(ngrok_url_sonnet, {
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: prompt })
      });

      const data = await response.data;
      const content = data?.content;
      console.log('content from handleAddElement:', content);

      if (content) {
        const newElements = [{
          codeName: inputValue,
          codeText: content,
          selected: false
        }];

        // if (content) {
        //   // Split the content by 'code piece:'
        //   const splitContent = content.split('code piece:');

        //   console.log('splited array:', splitContent)
          
        //   // Filter the array to include only even index items
        //   const evenIndexItems = splitContent.filter((item, index) => index % 2 === 1);
        
        //   // Join the filtered items back into a string (if needed)
        //   const filteredContent = evenIndexItems.join('code piece:');
        
        //   // Create the newElements array with the filtered content
        //   const newElements = [{
        //     codeName: inputValue,
        //     codeText: filteredContent,
        //     selected: false
        //   }];
  
        setVersions(prevVersions => {
          const updatedVersions = prevVersions.map(version =>
            version.id === currentVersionId
              ? { ...version, reuseableElementList: [...version.reuseableElementList, ...newElements] }
              : version
          );
          return updatedVersions;
        });

        setInputValue(''); // Clear input after adding
      }
    } catch (error) {
      console.error('Error adding reusable element:', error);
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

  const handleMouseEnter = () => {
    setIsMouseOver(true);
  };

  const handleMouseLeave = () => {
    setIsMouseOver(false);
  };

  const handleElementClick = (versionId: string, codeName: string) => {
    setVersions(prevVersions => {
      const updatedVersions = prevVersions.map(version =>
        version.id === versionId
          ? {
              ...version,
              reuseableElementList: version.reuseableElementList.map(element =>
                element.codeName === codeName
                  ? { ...element, selected: !element.selected }
                  : element
              )
            }
          : version
      );
      return updatedVersions;
    });
  };

  return (
    <div
      className={`reusable-element-toolbar ${isMouseOver ? 'expanded' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="reusable-elements">
        <div className="input-group">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter element description"
          />
          <button onClick={() => currentVersionId && handleAddElement(currentVersionId)} disabled={loading}>
            {loading ? 'Loading...' : 'Add'}
          </button>
        </div>
        {currentVersionId !== null && versions.find(version => version.id === currentVersionId)!.reuseableElementList.map((element, index) => (
        <div
          key={index}
          className={`reusable-element-item ${element.selected ? 'selected' : ''}`}
          onClick={() => handleElementClick(currentVersionId, element.codeName)}
          onMouseEnter={() => setHoveredElement(element.codeText)}
          onMouseLeave={() => setHoveredElement(null)}
        >
          <span>{element.codeName}</span>
          <button className="delete-icon" onClick={() => handleDeleteReusableElement(currentVersionId, element.codeName)}>🆇</button>
          {hoveredElement === element.codeText && (
            <div className="hovered-element-text">
              <pre>{element.codeText}</pre>
            </div>
          )}
        </div>
      ))}
      </div>
    </div>
  );
};

export default ReusableElementToolbar;
