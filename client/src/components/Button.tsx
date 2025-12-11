
import type { ReactNode } from "react"

interface Props {
    children: ReactNode,
    color?: 'primary' | 'danger' | 'secondary',
    func: () => void
}

const Button = ({children, color = "primary", func} : Props) => {
    let cn = "btn btn-"
    cn+= color
    return (
        <button type="button" className={cn} onClick={func}>{children}</button>
    )
}

export default Button