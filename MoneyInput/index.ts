import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class MoneyInput implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement;
    private _inputContainer: HTMLDivElement;
    private _currencySpan: HTMLSpanElement;
    private _inputElement: HTMLInputElement;
    
    private _value: number | null = null;
    private _formattedValue = "";
    
    private _notifyOutputChanged: () => void;
    private _lastResetValue = false;
    
    // Internal state to track decimals
    private _decimals = 2;
    
    private _inputHandler: (event: Event) => void;
    private _blurHandler: (event: Event) => void;

    /**
     * Empty constructor.
     */
    constructor() {
        // Empty
    }

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        try {
            this._notifyOutputChanged = notifyOutputChanged;
            this._container = container;
            
            // --- CRITICAL FIX FOR HEIGHT ---
            context.mode.trackContainerResize(true);
            
            this._container.classList.add("MoneyInput");
            this._container.style.display = "flex";
            this._container.style.alignItems = "stretch";
            this._container.style.overflow = "hidden";

            // Create Container
            this._inputContainer = document.createElement("div");
            this._inputContainer.classList.add("money-input-container");

            // Create Currency Symbol Span
            this._currencySpan = document.createElement("span");
            this._currencySpan.classList.add("money-input-currency");

            // Create Input Element
            this._inputElement = document.createElement("input");
            this._inputElement.type = "text";
            this._inputElement.classList.add("money-input-field");

            // Attach event listeners prevent memory leak by saving bound reference
            this._inputHandler = this.onInput.bind(this);
            this._blurHandler = this.onBlur.bind(this);
            this._inputElement.addEventListener("input", this._inputHandler);
            this._inputElement.addEventListener("blur", this._blurHandler);

            // Append to container
            this._inputContainer.appendChild(this._currencySpan);
            this._inputContainer.appendChild(this._inputElement);
            this._container.appendChild(this._inputContainer);
        } catch (e) {
            console.error("MoneyInput PCF init error:", e);
        }
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        try {
            const { parameters } = context;

            // --- 1. Settings & Styles ---
            this._decimals = parameters.DecimalPlaces?.raw ?? 2;
            this._currencySpan.innerText = parameters.CurrencySymbol?.raw || "$";

            // --- DIMENSIONAMIENTO DIRECTO EN PX ---
            const allocatedW = context.mode.allocatedWidth;
            const allocatedH = context.mode.allocatedHeight;
            if (allocatedW > 0) {
                this._inputContainer.style.width = `${allocatedW}px`;
            } else {
                this._inputContainer.style.width = "100%";
            }
            if (allocatedH > 0) {
                this._inputContainer.style.height = `${allocatedH}px`;
            } else {
                this._inputContainer.style.height = "100%";
            }
            
            // Apply neutral base styles
            this._inputContainer.style.borderRadius = "10px";
            this._inputContainer.style.backgroundColor = "#FFFFFF";
            this._inputContainer.style.borderColor = "#000000";
            this._inputContainer.style.borderWidth = "1px";
            this._inputContainer.style.borderStyle = "solid";
            
            this._inputElement.style.fontSize = "14px";
            this._inputElement.style.color = "#000000";
            this._currencySpan.style.fontSize = "14px";
            this._currencySpan.style.color = "#000000";

            // Quitar bordes y fondos del input
            this._inputElement.style.backgroundColor = "transparent";
            this._inputElement.style.border = "none";
            
            this._inputContainer.style.paddingLeft = "8px";
            this._inputContainer.style.paddingRight = "8px";
            this._inputContainer.style.paddingTop = "0px";
            this._inputContainer.style.paddingBottom = "0px";
            this._inputElement.style.textAlign = "right";

            // Remover estilos de posicion absoluta del TS para volver al flow normal
            this._currencySpan.style.position = "";
            this._currencySpan.style.left = "";
            this._inputElement.style.paddingLeft = "0px";
            this._inputElement.style.paddingRight = "4px";

            // --- 2. Display Mode Logic ---
            // 0=Edit, 1=View, 2=Disabled
            const displayMode = parameters.ComponentDisplayMode?.raw ?? 0;
            if (displayMode === 1) { // View
                this._inputElement.readOnly = true;
                this._inputElement.disabled = false;
                this._inputContainer.classList.add("view-mode");
                this._inputContainer.classList.remove("disabled-mode");
            } else if (displayMode === 2) { // Disabled
                this._inputElement.readOnly = false;
                this._inputElement.disabled = true;
                this._inputContainer.classList.add("disabled-mode");
                this._inputContainer.classList.remove("view-mode");
            } else { // Edit
                this._inputElement.readOnly = false;
                this._inputElement.disabled = false;
                this._inputContainer.classList.remove("view-mode", "disabled-mode");
            }

            // --- 3. Reset Flow ---
            const currentReset = parameters.TriggerReset?.raw === true;
            if (currentReset && !this._lastResetValue) {
                // Trigger Reset -> Load Default Value
                const defaultVal = parameters.DefaultValue?.raw ?? null;
                this.updateInternalValue(defaultVal);
                this._lastResetValue = true;
                // EVITAR CRASH FATAL: No se puede llamar a _notifyOutputChanged sincronamente en updateView
                setTimeout(() => this._notifyOutputChanged(), 0);
            } else if (!currentReset) {
                this._lastResetValue = false;
                
                // If not resetting AND not currently typing, update from external 'MoneyValue' bound property
                // We check document.activeElement so we don't overwrite user's intermediate typing
                if (document.activeElement !== this._inputElement) {
                    // Determine if we use bound MoneyValue or DefaultValue (on first load)
                    if (parameters.MoneyValue?.raw != null) {
                        this.updateInternalValue(parameters.MoneyValue.raw);
                    } else if (parameters.DefaultValue?.raw != null && this._value === null) {
                        this.updateInternalValue(parameters.DefaultValue.raw);
                        // EVITAR CRASH FATAL
                        setTimeout(() => this._notifyOutputChanged(), 0);
                    } else {
                        this.updateInternalValue(null);
                    }
                }
            }
        } catch (e) {
            console.error("MoneyInput PCF updateView error:", e);
        }
    }

    public getOutputs(): IOutputs {
        try {
            return {
                MoneyValue: this._value !== null ? this._value : undefined,
                FormattedValue: this._formattedValue
            };
        } catch (e) {
            console.error("MoneyInput PCF getOutputs error:", e);
            return {};
        }
    }

    public destroy(): void {
        try {
            this._inputElement.removeEventListener("input", this._inputHandler);
            this._inputElement.removeEventListener("blur", this._blurHandler);
        } catch (e) {
            console.error("MoneyInput PCF destroy error:", e);
        }
    }

    // --- Private Helper Methods ---

    private onInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        let cursorPosition = input.selectionStart || 0;
        const originalLength = input.value.length;

        // 1. Sanitize: Allow only digits and a single decimal point
        let sanitized = input.value.replace(/[^0-9.]/g, '');
        let parts = sanitized.split('.');
        if (parts.length > 2) {
            sanitized = parts[0] + '.' + parts.slice(1).join('');
            parts = sanitized.split('.');
        }

        // 1.5 Limit the decimal places during typing
        if (parts.length === 2 && parts[1].length > this._decimals) {
            parts[1] = parts[1].substring(0, this._decimals);
            sanitized = parts[0] + '.' + parts[1];
        }

        // 2. Format with commas
        const formatted = this.formatNumberString(sanitized);

        // 3. Re-apply to input
        input.value = formatted;

        // 4. Reposition Cursor
        const newLength = formatted.length;
        cursorPosition = cursorPosition + (newLength - originalLength);
        input.setSelectionRange(cursorPosition, cursorPosition);

        // 5. Update internal values and notify Canvas App
        const parsedValue = parseFloat(sanitized);
        this._value = isNaN(parsedValue) ? null : parsedValue;
        this._formattedValue = formatted;
        
        this._notifyOutputChanged();
    }

    private onBlur(event: Event): void {
        // Enforce decimal places when the user leaves the field
        if (this._value !== null) {
            this.updateInternalValue(this._value);
            this._notifyOutputChanged();
        }
    }

    private updateInternalValue(val: number | null): void {
        if (val === null) {
            this._value = null;
            this._formattedValue = "";
            this._inputElement.value = "";
        } else {
            // Apply decimals and format
            const fixedStr = val.toFixed(this._decimals);
            this._value = parseFloat(fixedStr); // Sync internal true value with rounding
            this._formattedValue = this.formatNumberString(fixedStr);
            this._inputElement.value = this._formattedValue;
        }
    }

    private formatNumberString(valStr: string): string {
        if (!valStr) return "";
        const parts = valStr.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.join('.');
    }
}
