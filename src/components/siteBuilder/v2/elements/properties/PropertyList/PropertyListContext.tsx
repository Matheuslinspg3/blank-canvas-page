import { createContext, useContext } from 'react';

const PropertyListContext = createContext<any[]>([]);

export const PropertyListProvider = PropertyListContext.Provider;
export function usePropertyListContext() {
  return useContext(PropertyListContext);
}
