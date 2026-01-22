
import { cn } from "@/lib/utils";

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    required?: boolean;
}

export function FormLabel({ children, className, required, ...props }: FormLabelProps) {
    return (
        <label className={cn("block text-sm font-medium mb-1.5 text-foreground/90", className)} {...props}>
            {children}
            {required && <span className="text-destructive ml-1">*</span>}
        </label>
    );
}
