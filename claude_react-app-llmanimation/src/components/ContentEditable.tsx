import React, { useEffect } from 'react';
import { Version } from '../types';

interface ContentEditableProps {
  value: string;
  onChange: (value: string) => void;
  onRightClick: (word: string) => void;
  onTabPress: (value: string) => void;
  onDoubleClick: (word: string) => void;
  currentVersionId: string | null;
  versions: Version[];
  setVersions: React.Dispatch<React.SetStateAction<Version[]>>;
  paramCheckEnabled: boolean;
  specificParamList: string[];
  onSpecificParamRightClick: (word: string) => void;
}


// How description content editables work: 
// whenever description updates: description (with [] and {})from specific version as prop; -> formatted to html (with all details saved) -> displayed
// whenever user edit the content, html content will be sanitized to text, restore all the hidden details, and saved in latestDescriptionText (latestDescriptionText will be initiated by description)
// when user rightclick a word, showDetails is updated to control show/hide detail. also the latestDescriptionText will be used to update description (so right click is also saving)
// whenever user tab to save the content, html content will be sanitized to text, restore all the hidden details, be used to update description for specific version

// How param check work:
// when user click parse desc, description will be sent to GPT and get a response to make a list of parameter text pieces (specificParamList)
// if paramCheckEnabled, text pieces that is in specificParamList will be rendered green
// when user rightclick a word, the parameter pieces in specificParamList that contains this word will be removed from the description for this version

// since all the user interactions here must happen when user is on correct page, we can just use currentversionId to access all version specific states
const ContentEditable: React.FC<ContentEditableProps> = ({ value, onChange, onRightClick, onTabPress, onDoubleClick, currentVersionId,  versions, setVersions,  paramCheckEnabled, specificParamList, onSpecificParamRightClick}) => {
  
  //after value (description) change, update formatDescriptionHtml (formatDescriptionHtml is to get full hidden info)
  useEffect(() => {
    console.log('contenteditable-useeffect', value)
    const formattedvalue = formatDescription(value);
    console.log('useeffect check formattedvalue:', formattedvalue)
    setVersions((prevVersions) => {
      const updatedVersions = prevVersions.map(version =>
        version.id === currentVersionId
          ? { ...version, formatDescriptionHtml: formattedvalue }
          : version
      );
      return updatedVersions;
    });  
    // console.log('contenteditable-useeffect2', formattedvalue)
    // console.log('contenteditable-useeffect3', versions)
  }, [value, versions.find(version => version.id === currentVersionId)?.showDetails, value, versions.find(version => version.id === currentVersionId)?.specificParamList]);

  //user edit desc
  const handleInput = (event: React.FormEvent<HTMLSpanElement>) => {
    const innerHTML = (event.target as HTMLSpanElement).innerHTML;
    const sanitizedText = sanitizeText(innerHTML);
    // console.log('handleinput1', sanitizedText)
    // console.log('handleinput2', versions.find(version => version.id === currentVersionId)?.hiddenInfo)
    const version = versions.find(version => version.id === currentVersionId);
    let hiddenInfo: string[] = version?.hiddenInfo || [];
    const restoredText = restoreDetails(sanitizedText, hiddenInfo);
    // console.log('handleinput3', restoredText)
    onChange(restoredText);// typed sth, update latestDescriptionText in specific version, can just use currentversionId

  };

  //user press tab to save edit
  // const handleKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
  //   if (event.key === 'Tab') {
  //     event.preventDefault(); // Prevent the default tab behavior
  //     const innerHTML = (event.target as HTMLSpanElement).innerHTML;
  //     const sanitizedText = sanitizeText(innerHTML);
  //     const restoredText = restoreDetails(sanitizedText);
  //     onTabPress(restoredText); // tab pressed, update description for specific version, can just use currentversionId
  //   }
  // };
  
  //user press tab to save edit
  //this updated handlekeydown will ensure if user delete an entity, there is no bug
  const handleKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault(); // Prevent the default tab behavior
      const innerHTML = (event.target as HTMLSpanElement).innerHTML;
      const sanitizedText = sanitizeText(innerHTML);
  
      // Get original description and hiddenInfo
      const version = versions.find(version => version.id === currentVersionId);
      const originalDescription = version?.description || '';
      let hiddenInfo: string[] = version?.hiddenInfo || [];
      let updatedhiddenInfo: string[] = hiddenInfo;
      updatedhiddenInfo = hiddenInfo;
      // Extract entities in [] from original description
      const originalEntities = (originalDescription.match(/\[(.*?)\]/g) || []).map(entity => entity.replace(/[\[\]]/g, ''));
      const sanitizedEntities = (sanitizedText.match(/\[(.*?)\]/g) || []).map(entity => entity.replace(/[\[\]]/g, ''));
  
      // Check for missing entities
      const missingEntities = originalEntities.filter(entity => !sanitizedEntities.includes(entity));
      
      if (missingEntities.length > 0) {
        // Get index of the missing entity
        const missingIndex = originalEntities.indexOf(missingEntities[0]);
        console.log('a word missing at', missingIndex)
        // Remove the corresponding hidden info
        updatedhiddenInfo = hiddenInfo.filter((_, index) => index !== missingIndex);
        console.log('update hidden info', updatedhiddenInfo)
        // Update the hidden info in the version
        setVersions(prevVersions => {
          const updatedVersions = prevVersions.map(version =>
            version.id === currentVersionId
              ? { ...version, hiddenInfo: updatedhiddenInfo}
              : version
          );
          return updatedVersions;
        });
      }
  
      // Restore text and proceed
      const restoredText = restoreDetails(sanitizedText, updatedhiddenInfo);
      onTabPress(restoredText); // tab pressed, update description for specific version, can just use currentversionId
    }
  };
  

  const handleRightClick = (event: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
    event.preventDefault();
    const target = event.target as HTMLSpanElement;
    let word = target.getAttribute("data-word");
    console.log('right click', word)
  
    if (!word) {
      const parent = target.closest('[data-word]');
      if (parent) {
        word = parent.getAttribute('data-word');
      } else {
        const detailSpan = target.closest('span[style="color: MediumVioletRed;"]');
        if (detailSpan) {
          const detailText = detailSpan.textContent || '';
          specificParamList.forEach(param => {
            if (detailText.includes(param.trim())) {
              word = param;
            }
          });
        }
      }
    }
  
    if (word) {
      if (paramCheckEnabled && specificParamList.some(param => word && param.includes(word))) {
        const fullParam = specificParamList.find(param => word && param.includes(word));
        if (fullParam) {
          onSpecificParamRightClick(fullParam);
        }
      } else if (word.startsWith('[') && word.endsWith(']')) {
        onRightClick(word.slice(1, -1)); // Remove brackets
      } else {
        onRightClick(word);
      }
    }
  };
  
  
  

  //user select a word
  const handleDoubleClick = (event: React.MouseEvent) => {
    // console.log('double clicked')
    const selection = window.getSelection();
    if (selection) {
      const word = selection.toString().trim();
      if (word) {
        onDoubleClick(word); // Notify the double-clicked word
      }
    }
  };

  // format description from text to html with correct show/hidden details
  //while we do so, we save all the details first, since description will always have full details but formatted html text won't
  const formatDescription = (desc: string): string => {
    const parts = desc.split(/(\[.*?\]\{.*?\})/g);
    const details: string[] = [];
    const formatted = parts.map((part, index) => {
      const match = part.match(/\[(.*?)\]\{(.*?)\}/);
      if (match) {
        const word = match[1];
        const detail = match[2];
        details.push(detail);
        const isShown = versions.find(version => version.id === currentVersionId)?.showDetails[word];
  
        let formattedDetail = detail;
        specificParamList.forEach(param => {
          if (detail.includes(param.trim()) && param != '') {
            formattedDetail = formattedDetail.replace(
              new RegExp(`(${param.trim()})`, 'g'),
              `<span style="background-color: #FADBD8;" data-word="${param.trim()}">$1</span>`
            );
          }
        });
  
        return `
          <span>
            <span style="color: red; cursor: pointer;" data-word="${word}">
              [${word}]
            </span>
            ${isShown ? `<span style="color: MediumVioletRed;">{${formattedDetail}}</span>` : ''}
          </span>
        `;
      }
      return part;
    }).join('');
  
    setVersions((prevVersions) => {
      const updatedVersions = prevVersions.map(version =>
        version.id === currentVersionId
          ? { ...version, hiddenInfo: details }
          : version
      );
      return updatedVersions;
    });
  
    return formatted;
  };
  
  
  
  

  const sanitizeText = (html: string): string => {
    const tempElement = document.createElement('div');
    tempElement.innerHTML = html;
    const plainText = tempElement.innerText;
    return plainText;
  };

  // since the html texts (formatteddescription) don't contain details once they are hidden, everytime we need to update the description, 
  // we need to add back the hidden details
  const restoreDetails = (text: string, hiddenInfo: string[]): string => {
    const parts = text.split(/(\[.*?\])/g);
    console.log('parts', parts);
    let hiddenInfoIndex = 0;
    return parts.map((part, index) => {
      if (part.startsWith('[') && part.endsWith(']')) {
        const nextPart = parts[index + 1] || '';
        const trimmedNextPart = nextPart.replace(/\s+/g, ' ').trim(); // Replace multiple whitespace with a single space and trim
        const hasDetail = /\{\s*.*?\s*\}/.test(trimmedNextPart); // Check if trimmed nextPart contains {}
        // const hiddenInfo = versions.find(version => version.id === currentVersionId)?.hiddenInfo || [];
        console.log('restore detail, hidden info', hiddenInfo, versions)
        console.log('restore detail', part, hasDetail, hiddenInfoIndex, hiddenInfo[hiddenInfoIndex]);
        if (!hasDetail && hiddenInfoIndex < hiddenInfo.length) {
          return `${part}{${hiddenInfo[hiddenInfoIndex++]}}`;
        }
        hiddenInfoIndex++;
      }
      return part;
    }).join('');
  };
  
  

  return (
    <span
      contentEditable
      onInput={handleInput}
      onKeyDown={handleKeyDown} // Add keydown event listener
      onContextMenu={handleRightClick}
      onDoubleClick={handleDoubleClick}
      className="custom-textarea"
      dangerouslySetInnerHTML={{ __html: versions.find(version => version.id === currentVersionId)?.formatDescriptionHtml.replace('] {', ']{') || '' }}
      style={{ outline: 'none' }} // Remove the blue border outline
    />
  );
};

export default ContentEditable;
