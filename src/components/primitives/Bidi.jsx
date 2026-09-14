/**
 * Bidirectional text isolation.
 *
 * Roughly a third of the places in this dataset have Arabic names. Rendering
 * one inside a heading without isolation reorders the surrounding punctuation
 * and trailing elements -- which is exactly what the old card did.
 *
 * `dir="auto"` resolves direction from the first strong character, and it must
 * sit on the element that truncates, or the ellipsis lands on the wrong side.
 */
export const Bidi = ({ as: Tag = 'span', children, ...rest }) => (
    <Tag dir="auto" {...rest}>
        <bdi>{children}</bdi>
    </Tag>
);

/** Numbers and units, kept left-to-right even beside RTL text. */
export const Num = ({ children, className = '' }) => (
    <span dir="ltr" className={className}>
        {children}
    </span>
);

export default Bidi;
