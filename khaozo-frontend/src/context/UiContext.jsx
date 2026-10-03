// App-wide sheets opened from anywhere: the "+" Add menu and the place picker it leads to.
import { createContext, useContext, useMemo, useState } from 'react';

const UiContext = createContext(null);

export function UiProvider({ children }) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [placePicker, setPlacePicker] = useState(null); // null | 'rate' | 'review'
  const value = useMemo(
    () => ({ addMenuOpen, setAddMenuOpen, placePicker, setPlacePicker }),
    [addMenuOpen, placePicker],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export const useUi = () => useContext(UiContext);
