/// <reference types="nativewind/types" />

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare module "react-native-bottom-sheet";
