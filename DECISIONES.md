# Hide-Seek-Madrid: decisiones del proyecto

Versión personalizada del generador de mapas de taibeled/JetLagHideAndSeek (licencia MIT) para jugar a *Jet Lag: The Game – Hide + Seek* en la **Comunidad de Madrid** con un grupo de amigos. Este documento recoge lo decidido para que cualquiera pueda continuar el trabajo.

## Publicación

- GitHub Pages en `https://paramaxksp.github.io/Hide-Seek-Madrid/` (HTTPS, necesario para el GPS).
- La URL no se comparte públicamente; buscadores bloqueados (`noindex` y `robots.txt`).
- Sin analítica: se han quitado Google Analytics y Microsoft Clarity del proyecto original.
- El texto del reglamento oficial y las fotos del libro **no** se suben al repositorio.

## Funciones confirmadas

**Mapa y datos**
- Zona de juego: toda la Comunidad de Madrid.
- Mapa base gratuito sin clave de API. Un mapa base propio (PMTiles) queda como mejora futura.
- Capa propia de Metro, Metro Ligero y Cercanías a partir de los datos oficiales (GTFS del Consorcio y de Renfe): colores, trazados y estaciones por línea.
- Puntos de interés precalculados y guardados en la app, sin consultas en directo a Overpass.
- Distancias a puntos de interés medidas al «icono»: los sitios se guardan como puntos.
- Bordes del mapa oficiales: lo de fuera no existe; la app avisa cuando una pregunta daría respuesta nula. Se pueden dibujar zonas excluidas.

**Preguntas**
- Datos extra para Madrid: municipios (3.ª división), distritos de Madrid (4.ª), altitud con modelo de elevación, masas de agua y líneas de alta velocidad.
- «¿Misma línea?» según las paradas reales de cada servicio: un tren que se salta la estación cuenta como «no»; una estación puede estar en varias líneas.
- En cada pregunta: multiplicador de coste visible al repetir, y botones de **veto** y **randomize** (sorteo de otra pregunta no hecha de la misma categoría).
- Lo llevan los jugadores a mano: una sola pregunta pendiente, robo de cartas y categorías bloqueadas.

**Partida**
- Interfaz en español, preparada para traducciones.
- GPS del buscador como origen de la pregunta con un toque.
- Ayuda de termómetro con GPS: punto de inicio y aviso de distancia en línea recta.
- Modo escondido que calcula automáticamente la respuesta correcta.
- Powerup *Move*: empezar una zona nueva conservando el historial y la estación revelada.
- Activar o desactivar líneas enteras como zonas de escondite.
- Reloj de partida (tiempo de escondite, pausas, descansos, rondas), si es sencillo.

**Configuraciones**
- Predefinidas (p. ej. toda la Comunidad, solo el centro) y personalizadas creadas por los jugadores.
- Se comparten por enlace o archivo, sin servidor.
- Tamaño de partida: **mediano** por defecto, configurable.
- Las correcciones de sitios hechas en partida viajan con la configuración. En caso de disputa, manda la app.

**Descartado por ahora**
- Compartir la partida en tiempo real entre móviles (se usa Google Maps para compartir ubicación).

## Líneas de transporte

- **Metro de Madrid:** líneas y paradas de OpenStreetMap (el GTFS oficial publicado es de 2025 y no incluye la línea 3). Colores oficiales del Consorcio. Toda la red supera 1 tren/hora.
- **Metro Ligero:** GTFS oficial del Consorcio.
- **Cercanías:** GTFS oficial de Renfe (núcleo de Madrid).
- Frecuencias calculadas para el viernes 30/10/2026 entre las 6:00 y las 18:00: una estación queda fuera si en alguna franja horaria no pasa ningún tren de ninguna de sus líneas (Zarzalejo, Robledo de Chavela, Santa María de la Alameda y Puerto de Navacerrada).
- Las estaciones fuera de la Comunidad (p. ej. Guadalajara) no existen en el mapa.
- **Estaciones de intercambio (regla de casa):** cuando Metro, Metro Ligero y Cercanías tienen estación en el mismo sitio (a menos de 450 m y con el mismo nombre), se juntan en una sola estación en el punto medio, con una sola zona de escondite. Son 30; la lista está en `data-src/estaciones_unidas.txt`.
- **¿Misma línea?:** es una pregunta normal (no hace falta activar las zonas de escondite). Si la respuesta es sí, quedan las zonas de escondite de las estaciones de esa línea; si es no, las del resto de estaciones. Los buscadores eligen en qué línea van; cuentan todas las estaciones en las que para algún tren de esa línea. La app avisa cuando la línea tiene trenes que pasan sin parar por alguna estación.
- Se pueden quitar líneas enteras como zonas de escondite: una estación desaparece cuando todas sus líneas están quitadas.
- Para regenerar: `python3 -I scripts/gtfs_to_transit.py …` y después `node scripts/build-madrid-data.mjs`.

## Exclusiones del mapa

- **No** se excluye el aeropuerto: su zona pública es un escondite válido.
- Se excluyen zonas conocidas por alta criminalidad, a partir de datos oficiales (Ministerio del Interior por municipio, Ayuntamiento por distrito) más la Cañada Real. Lista pendiente de revisión por los jugadores.
- Se excluyen estaciones que no reciban al menos **1 tren/hora** de una misma línea. Horario de prueba: laborables de 6:00 a 18:00 (octubre de 2026); el horario definitivo está por decidir.

## Reglas de casa sobre categorías

- **Aeropuerto:** Barajas, Torrejón, Cuatro Vientos y Getafe, aunque los tres últimos no sean comerciales.
- **Consulado extranjero:** cuentan las embajadas.
- **Montaña:** cimas con nombre de 1.200 m o más, incluidas las del límite provincial (p. ej. Peñalara).
- **El Corte Inglés** y **centros comerciales** son categorías separadas.

## Categorías y criterios

| Categoría | Sitios | Criterio |
|---|---|---|
| Aeropuertos | 4 | Lista cerrada (ver reglas de casa) |
| Estadios y arenas | 14 | Lista cerrada: Bernabéu, Metropolitano, Vallecas, Coliseum, Butarque, Alfredo Di Stéfano, Santo Domingo, Cerro del Espino, Centro Deportivo de Alcalá, Movistar Arena, Vistalegre Arena, Madrid Arena, Caja Mágica, Pabellón Fernando Martín |
| Mercadona | 193 | Marca en OSM (cifra oficial: 199) |
| McDonald's | 104 | Marca en OSM (cifra publicada: 108) |
| El Corte Inglés | 12 | Grandes almacenes; sin supermercados ni outlets |
| IKEA | 3 | Solo grandes tiendas |
| Centros comerciales | 35 | Con nombre y ≥ 2 ha, más Xanadú. Pendiente: revisar centros conocidos que el filtro de superficie dejó fuera |
| Universidades | 22 | Campus de ≥ 5 ha, sin duplicados |
| Mercados municipales | 50 | Mercados cubiertos «Mercado…» |
| Cementerios | 71 | Con nombre y ≥ 0,5 ha |
| Palacios y castillos | 44 | Todos los que tienen nombre |
| Plazas de toros | 53 | Fijas; sin desmontables |
| Museos | 186 | Con nombre |
| Cines | 75 | Con nombre |
| Bibliotecas | 244 | Con nombre y acceso público |
| Hospitales | 78 | Hospitales y ciudades sanitarias; sin centros de salud ni urgencias |
| Embajadas y consulados | 164 | Sin consulados honorarios |
| Zoos | 3 | Revisado a mano |
| Acuarios | 2 | Revisado a mano |
| Parques de atracciones | 2 | Parque de Atracciones y Parque Warner |
| Campos de golf | 25 | ≥ 10 ha; sin pitch & putt ni campos de prácticas |
| Parques | 215 | Con nombre y ≥ 5 ha |
| Masas de agua | 51 | Embalses y lagunas de ≥ 2 ha |
| Montañas | 342 | ≥ 1.200 m |
| Ríos | 8 | Manzanares, Jarama, Henares, Guadarrama, Tajo, Tajuña, Lozoya, Alberche |
| Alta velocidad | — | Vías de alta velocidad dentro de la Comunidad |

Fuente de los datos: © colaboradores de OpenStreetMap (ODbL), extraídos el 29–30/10/2026 y revisados a mano contra Google Maps. Límites municipales: Instituto Geográfico Nacional.
