
import { useState, type MouseEvent } from "react";

interface Props {
    items: string[],
    heading: string,
    onSelectItem: (item: string) => void
}

function ListGroup(props: Props) {
  
  const [selectedIndex, setSelectedIndex] = useState(-1)

    
  return (
  <>
    <h1>{props.heading}</h1>
    {props.items.length === 0 && <p>No item found</p>}

    {props.items.length > 0 && (
        <>
      <ul className="list-group">
        {props.items.map((item, index) => (
          <li className = {index === selectedIndex ? 
            'list-group-item active' : 
            'list-group-item'} 
          key={item} 
          onClick={() => {
            setSelectedIndex(index)
            props.onSelectItem(item)
        }}>{item}</li>
        ))}
      </ul>
      </>
    )}
  </>
);

}

export default ListGroup;
