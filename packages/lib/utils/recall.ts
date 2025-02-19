import { RefObject, useEffect } from "react";

import { TI18nString, TSurvey, TSurveyQuestion } from "@formbricks/types/surveys";

import { getLocalizedValue } from "../i18n/utils";

export interface fallbacks {
  [id: string]: string;
}

// Extracts the ID of recall question from a string containing the "recall" pattern.
export const extractId = (text: string): string | null => {
  const pattern = /#recall:([A-Za-z0-9]+)/;
  const match = text.match(pattern);
  if (match && match[1]) {
    return match[1];
  } else {
    return null;
  }
};

// If there are multiple recall infos in a string extracts all recall question IDs from that string and construct an array out of it.
export const extractIds = (text: string): string[] => {
  const pattern = /#recall:([A-Za-z0-9]+)/g;
  const matches = Array.from(text.matchAll(pattern));
  return matches.map((match) => match[1]).filter((id) => id !== null);
};

// Extracts the fallback value from a string containing the "fallback" pattern.
export const extractFallbackValue = (text: string): string => {
  const pattern = /fallback:(\S*)#/;
  const match = text.match(pattern);
  if (match && match[1]) {
    return match[1];
  } else {
    return "";
  }
};

// Extracts the complete recall information (ID and fallback) from a headline string.
export const extractRecallInfo = (headline: string): string | null => {
  const pattern = /#recall:([A-Za-z0-9]+)\/fallback:(\S*)#/;
  const match = headline.match(pattern);
  return match ? match[0] : null;
};

// Finds the recall information by a specific recall question ID within a text.
export const findRecallInfoById = (text: string, id: string): string | null => {
  const pattern = new RegExp(`#recall:${id}\\/fallback:(\\S*)#`, "g");
  const match = text.match(pattern);
  return match ? match[0] : null;
};

// Converts recall information in a headline to a corresponding recall question headline, with or without a slash.
export const recallToHeadline = (
  headline: TI18nString,
  survey: TSurvey,
  withSlash: boolean,
  language: string
): TI18nString => {
  let newHeadline = structuredClone(headline);
  if (!newHeadline[language]?.includes("#recall:")) return headline;

  while (newHeadline[language].includes("#recall:")) {
    const recallInfo = extractRecallInfo(getLocalizedValue(newHeadline, language));
    if (recallInfo) {
      const questionId = extractId(recallInfo);
      let questionHeadline = getLocalizedValue(
        survey.questions.find((question) => question.id === questionId)?.headline,
        language
      );
      while (questionHeadline?.includes("#recall:")) {
        const recallInfo = extractRecallInfo(questionHeadline);
        if (recallInfo) {
          questionHeadline = questionHeadline.replaceAll(recallInfo, "___");
        }
      }
      if (withSlash) {
        newHeadline[language] = newHeadline[language].replace(recallInfo, `/${questionHeadline}\\`);
      } else {
        newHeadline[language] = newHeadline[language].replace(recallInfo, `@${questionHeadline}`);
      }
    }
  }
  return newHeadline;
};

// Replaces recall information in a survey question's headline with an ___.
export const replaceRecallInfoWithUnderline = (
  recallQuestion: TSurveyQuestion,
  language: string
): TSurveyQuestion => {
  while (getLocalizedValue(recallQuestion.headline, language).includes("#recall:")) {
    const recallInfo = extractRecallInfo(getLocalizedValue(recallQuestion.headline, language));
    if (recallInfo) {
      recallQuestion.headline[language] = getLocalizedValue(recallQuestion.headline, language).replace(
        recallInfo,
        "___"
      );
    }
  }
  return recallQuestion;
};

// Checks for survey questions with a "recall" pattern but no fallback value.
export const checkForEmptyFallBackValue = (survey: TSurvey, langauge: string): TSurveyQuestion | null => {
  const findRecalls = (text: string) => {
    const recalls = text.match(/#recall:[^ ]+/g);
    return recalls && recalls.some((recall) => !extractFallbackValue(recall));
  };
  for (const question of survey.questions) {
    if (
      findRecalls(getLocalizedValue(question.headline, langauge)) ||
      (question.subheader && findRecalls(getLocalizedValue(question.subheader, langauge)))
    ) {
      return question;
    }
  }
  return null;
};

// Processes each question in a survey to ensure headlines are formatted correctly for recall and return the modified survey.
export const checkForRecallInHeadline = (survey: TSurvey, langauge: string): TSurvey => {
  const modifiedSurvey: TSurvey = structuredClone(survey);
  modifiedSurvey.questions.forEach((question) => {
    question.headline = recallToHeadline(question.headline, modifiedSurvey, false, langauge);
  });
  return modifiedSurvey;
};

// Retrieves an array of survey questions referenced in a text containing recall information.
export const getRecallQuestions = (text: string, survey: TSurvey, langauge: string): TSurveyQuestion[] => {
  if (!text.includes("#recall:")) return [];

  const ids = extractIds(text);
  let recallQuestionArray: TSurveyQuestion[] = [];
  ids.forEach((questionId) => {
    let recallQuestion = survey.questions.find((question) => question.id === questionId);
    if (recallQuestion) {
      let recallQuestionTemp = structuredClone(recallQuestion);
      recallQuestionTemp = replaceRecallInfoWithUnderline(recallQuestionTemp, langauge);
      recallQuestionArray.push(recallQuestionTemp);
    }
  });
  return recallQuestionArray;
};

// Constructs a fallbacks object from a text containing multiple recall and fallback patterns.
export const getFallbackValues = (text: string): fallbacks => {
  if (!text.includes("#recall:")) return {};
  const pattern = /#recall:([A-Za-z0-9]+)\/fallback:([\S*]+)#/g;
  let match;
  const fallbacks: fallbacks = {};

  while ((match = pattern.exec(text)) !== null) {
    const id = match[1];
    const fallbackValue = match[2];
    fallbacks[id] = fallbackValue;
  }
  return fallbacks;
};

// Transforms headlines in a text to their corresponding recall information.
export const headlineToRecall = (
  text: string,
  recallQuestions: TSurveyQuestion[],
  fallbacks: fallbacks,
  langauge: string
): string => {
  recallQuestions.forEach((recallQuestion) => {
    const recallInfo = `#recall:${recallQuestion.id}/fallback:${fallbacks[recallQuestion.id]}#`;
    text = text.replace(`@${recallQuestion.headline[langauge]}`, recallInfo);
  });
  return text;
};

// Custom hook to synchronize the horizontal scroll position of two elements.
export const useSyncScroll = (
  highlightContainerRef: RefObject<HTMLElement>,
  inputRef: RefObject<HTMLElement>,
  text: string
) => {
  useEffect(() => {
    const syncScrollPosition = () => {
      if (highlightContainerRef.current && inputRef.current) {
        highlightContainerRef.current.scrollLeft = inputRef.current.scrollLeft;
      }
    };

    const sourceElement = inputRef.current;
    if (sourceElement) {
      sourceElement.addEventListener("scroll", syncScrollPosition);
    }

    return () => {
      if (sourceElement) {
        sourceElement.removeEventListener("scroll", syncScrollPosition);
      }
    };
  }, [inputRef, highlightContainerRef, text]);
};
