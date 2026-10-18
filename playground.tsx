import React from 'react';
import ReactDOM from 'react-dom/client';
import { PixelPet } from './src/index';
import './src/styles.css';

const variant = new URLSearchParams(window.location.search).get('pet') === 'dog' ? 'dog' : 'cat';
const petName = "Danko"
const App = () => {
  return (
    <div style={{ textAlign: 'center' , color: '#197788', fontSize: '8px'}}>
      <h1 style={{ WebkitTextStroke: '1px #63b3c1' }}>Ambiente de pruebas <br/><span style={{ 
      display: 'inline-block',
      textAlign: 'center', 
      color: '#cd5b09', 
      WebkitTextStroke: '1px #063535',
      fontWeight: 'bold',
      fontSize: '50px',
      letterSpacing: '20px',
      marginTop: '20px',
      filter: 'drop-shadow(0px 4px 6px rgba(0, 0, 0, 0.8))',
      marginLeft: '25px'
    }} className='press-start-2p'>{ petName }</span> </h1>
      <PixelPet
        petName={petName}
        variant="dog"
        emotionDialogStyles={{
          happy: {
            backgroundColor: '#1e1c063d',
            borderColor: '#ffeb3b',
          },
          angry: {
            backgroundColor: '#21090833',
            borderColor: '#F04037',
          },
          curious: {
            backgroundColor: '#1f341d3a',
            borderColor: '#8BE383',
          },
        }}
      />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);