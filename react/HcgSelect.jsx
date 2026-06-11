/*!
 * HcgSelect - thin React wrapper around hcg-select (vanilla JS)
 * Author: HTML Code Generator
 * Page: https://www.html-code-generator.com/javascript/searchable-select
 * License: MIT
 *
 * Usage:
 *   import HcgSelect from "hcg-searchable-select/react/HcgSelect.jsx";
 *   import "hcg-searchable-select/hcg-select.css";
 *
 *   <HcgSelect value={country} onChange={setCountry} placeholder="Select a country">
 *     <option value="">- Select a country -</option>
 *     <option value="in">India</option>
 *     <option value="us">United States</option>
 *   </HcgSelect>
 */
import { useEffect, useRef } from "react";
import hcgSelect from "hcg-searchable-select";

export default function HcgSelect({
  value,
  defaultValue,
  onChange,
  placeholder,
  searchPlaceholder,
  noResultsText,
  typeAhead,
  clearable,
  disabled,
  required,
  name,
  id,
  className,
  children
}) {
  const selectRef = useRef(null);
  const apiRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /* - (re)initialize whenever the init-time options change. hcg-select captures
       placeholder / searchPlaceholder / noResultsText / typeAhead at init, so we
       destroy + re-create the widget when any of them change. - */
  useEffect(() => {
    const api = hcgSelect(selectRef.current, {
      placeholder,
      searchPlaceholder,
      noResultsText,
      typeAhead,
      clearable,
      onChange: (val, option, sel) => {
        if (onChangeRef.current) onChangeRef.current(val, option, sel);
      }
    });
    apiRef.current = api;
    return () => {
      if (apiRef.current) apiRef.current.destroy();
      apiRef.current = null;
    };
  }, [placeholder, searchPlaceholder, noResultsText, typeAhead, clearable]);

  /* - controlled value + option children: push into the native select, then refresh - */
  useEffect(() => {
    const sel = selectRef.current;
    if (!sel || !apiRef.current) return;
    if (value !== undefined && sel.value !== value) sel.value = value;
    apiRef.current.refresh();
  }, [value, children]);

  /* - disabled is its own concern: use the explicit setter (single source of truth) - */
  useEffect(() => {
    if (apiRef.current) apiRef.current.setDisabled(!!disabled);
  }, [disabled]);

  return (
    <select
      ref={selectRef}
      id={id}
      name={name}
      className={className}
      required={required}
      defaultValue={value === undefined ? defaultValue : undefined}
      data-placeholder={placeholder}
    >
      {children}
    </select>
  );
}
