from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import machines, users, clients, cartes, guide,historique,auth,sites ,ilots,postes_detection,types_defaut,codes_erreur,sessions_controle,defauts_detectes, ordres_fabrication


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(machines.router)
app.include_router(users.router)
app.include_router(clients.router)
app.include_router(cartes.router)
app.include_router(guide.router)
app.include_router(historique.router)   
app.include_router(auth.router)
app.include_router(sites.router)

app.include_router(ilots.router)
app.include_router(postes_detection.router)
app.include_router(types_defaut.router)
app.include_router(codes_erreur.router)
app.include_router(defauts_detectes.router)
app.include_router(ordres_fabrication.router)
app.include_router(sessions_controle.router)


