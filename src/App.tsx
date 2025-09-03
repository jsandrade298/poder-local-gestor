import React from 'react';

const App = () => {
  console.log('App está renderizando...');
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Sistema de Gestão de Gabinete
          </h1>
          <p className="text-gray-600">
            Sistema funcionando corretamente!
          </p>
        </header>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">
            ✅ Sistema Carregado
          </h2>
          <p className="text-gray-600 mb-4">
            O aplicativo está funcionando. Agora você pode testar o login.
          </p>
          
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <h3 className="font-medium text-blue-900">Próximo passo:</h3>
              <p className="text-blue-700">
                Clique no botão abaixo para acessar a página de login
              </p>
            </div>
            
            <a 
              href="/login" 
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Acessar Login
            </a>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-medium text-green-900 mb-2">
            Funcionalidades do Sistema:
          </h3>
          <ul className="text-green-700 space-y-1">
            <li>• Autenticação de usuários</li>
            <li>• Gestão de demandas</li>
            <li>• Cadastro de munícipes</li>
            <li>• Dashboard com métricas</li>
            <li>• Sistema de tags e áreas</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default App;