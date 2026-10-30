# Hide-Seek-Madrid: decisiones del proyecto

Versión personalizada del generador de mapas de taibeled/JetLagHideAndSeek (licencia MIT) para jugar a *Jet Lag: The Game – Hide + Seek* en la **Comunidad de Madrid** con un grupo de amigos. Este documento recoge lo decidido para que cualquiera pueda continuar el trabajo.

## Publicación

- GitHub Pages en `https://paramaxksp.github.io/Hide-Seek-Madrid/` (HTTPS, necesario para el GPS).
- La URL no se comparte públicamente; buscadores bloqueados (`noindex` y `robots.txt`).
- Sin analítica: se han quitado Google Analytics y Microsoft Clarity del proyecto original.
- Sin servicios de terceros para compartir: se ha quitado Pastebin y la carga de datos desde cualquier web (`?url=`).
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
- **Estaciones de intercambio (regla de casa):** cuando Metro, Metro Ligero y Cercanías tienen estación en el mismo sitio (a menos de 450 m y con el mismo nombre), se juntan en una sola estación en el punto medio, con una sola zona de escondite y el nombre de la de Metro. También se juntan las que están pegadas (a 100 m o menos) aunque se llamen distinto: Sierra de Guadalupe + Vallecas y Puerta de Arganda + Vicálvaro (Cercanías). Son 31; la lista está en `data-src/estaciones_unidas.txt`.
- **¿Misma línea?:** es una pregunta normal (no hace falta activar las zonas de escondite). Si la respuesta es sí, quedan las zonas de escondite de las estaciones de esa línea; si es no, solo se quitan (en azul) las zonas de las estaciones de esa línea y el resto del mapa queda igual; la parte de esas zonas que se solapa con la de otra estación sigue siendo posible. Los buscadores eligen en qué línea van; cuentan todas las estaciones en las que para algún tren de esa línea. La app avisa cuando la línea tiene trenes que pasan sin parar por alguna estación.
- Se pueden quitar líneas enteras como zonas de escondite: una estación desaparece cuando todas sus líneas están quitadas.
- Para regenerar: `python3 -I scripts/gtfs_to_transit.py …` y después `node scripts/build-madrid-data.mjs`.

## Preguntas de las categorías propias

- Aparecen en el grupo **Madrid** del desplegable de cada tipo de pregunta y funcionan sin activar las zonas de escondite.
- **Matching** («¿tu ___ más cercano es el mismo que el mío?»): Mercadona, McDonald's, El Corte Inglés, IKEA, estadios y arenas, plazas de toros, centros comerciales, universidades, mercados municipales, cementerios, palacios y castillos.
- **Measuring** («¿estás más cerca o más lejos que yo de un ___?»): las mismas y, además, los ríos.
- **Tentáculos** (2 km por defecto): Mercadona y McDonald's.
- Para que los sitios con el mismo nombre se distingan (los 192 Mercadona, las 18 «Plaza de Toros»…), se les añade el municipio (o el distrito en Madrid capital) y, si hace falta, la estación más cercana (a 2 km o menos). Si aun así coinciden, un número de norte a sur. Ejemplo: «Mercadona · Centro · Tribunal». La lista está en `data-src/nombres_distinguidos.txt`.
- Los sitios repetidos (mismo nombre a menos de 50 m) se quitan: el Mercado de Villaverde Alto estaba dos veces.

## Coste, veto y randomize

- Cada pregunta muestra su coste según el reglamento (partida mediana): Matching y Measuring, el escondido roba 3 y se queda 1; radar y termómetro, 2 y 1; tentáculos, 4 y 2; fotos, 1 y 1.
- **Repetir** una pregunta multiplica el coste: la 2.ª vez ×2 (roba 3 y se queda 1, dos veces), la 3.ª ×3… Cuentan como la misma pregunta sus variantes (p. ej. el zoo con o sin zonas de escondite, o un radar de 5 km y otro de 5000 m).
- **Veto:** la pregunta cuenta como hecha (repetirla cuesta más), no cambia el mapa, no se responde en modo escondido y no da cartas.
- **Randomize:** sortea otra pregunta no hecha de la misma categoría y la pone en el mismo sitio; la original no cuenta como hecha. El catálogo es el del reglamento para partida mediana más las reglas de casa (`src/maps/catalog.ts`).
- Las preguntas que la app no dibuja (fotos, calle o camino, masa de tierra, frontera, costa y nivel del mar, hasta que se haga la altitud) se apuntan como «sin mapa» para que cuenten en el coste y el sorteo.
- En Madrid, la 1.ª y la 2.ª división administrativa (comunidad y provincia) son la misma: el Matching siempre da «sí» y el Measuring mide al borde de la Comunidad. Frontera y costa no existen dentro del mapa: respuesta nula.
- El termómetro guarda la distancia de la pregunta (1, 5 o 15 km) y avisa de cuánto falta por recorrer en línea recta.

## GPS

- Las preguntas nuevas se crean en la ubicación del GPS del buscador (se puede desactivar en el diálogo de añadir); si el GPS falla, en el centro del mapa.
- El botón de ubicación de cada pregunta espera como mucho 15 s, avisa si la precisión es peor de ±100 m y explica en español por qué falla (sin permiso, sin GPS…).

## Configuraciones de partida

- Una configuración guarda: la zona (Comunidad, municipios y distritos, o un polígono dibujado), el tamaño de partida, el radio de las zonas de escondite, qué tipos de estación cuentan y las líneas y estaciones quitadas.
- **Tamaño de partida** (reglamento): pequeña y mediana, zonas de 500 m; grande, de 1 km. Tiempo para esconderse: 30, 60 y 180 min. Cambia las preguntas disponibles: sin tentáculos en pequeña; termómetro de 15 km desde mediana y de 75 km en grande; tentáculos de 25 km (zoos, acuarios, parques de atracciones y líneas de metro) y 4 fotos más en grande.
- **Predefinidas:**

| Configuración | Zona | Tamaño |
|---|---|---|
| Toda la Comunidad | 8.019 km², 355 estaciones | Mediana |
| Área metropolitana | Madrid y los 14 municipios con Metro o Metro Ligero: 1.261 km², 327 estaciones | Mediana |
| Madrid capital | 604 km², 220 estaciones | Mediana |
| Almendra central | Los 7 distritos de dentro de la M-30 (aprox.): 42 km², 80 estaciones | Pequeña |

- Las zonas hechas con municipios o distritos se unen cerrando las rendijas de unos metros que dejan los bordes vecinos (si no, el mapa las pintaba de azul como excluidas). Las zonas guardadas con la versión anterior se recalculan solas al abrir la app.
- Tipos de estación que pueden ser zona de escondite: todas, Metro, Metro Ligero o Cercanías (se quitaron las opciones genéricas de la app original: autobús, ferri, funicular…). Nunca puede quedar vacío: vuelve a «Todas».
- Cada jugador puede guardar la configuración actual con un nombre («Mis configuraciones»).
- **Compartir sin servidor:** por enlace (la configuración va comprimida detrás de `#`, que el navegador nunca envía a la web) o por archivo `.json`. Al abrir el enlace, la app pregunta antes de cargarla y la guarda en «Mis configuraciones».
- Cargar una configuración empieza una partida nueva: se borran las preguntas (la app avisa).
- **Compartir la partida** (zona y preguntas) también va por enlace con `#`; si no cabe (más de 16.000 caracteres), se descarga como archivo.
- Pendiente: que las correcciones de sitios hechas en partida viajen con la configuración (cuando exista la función de corregir sitios).

## Ayudas de partida

- **Reloj de partida** (botón en la barra de abajo): rondas con el nombre de quien se esconde, cuenta atrás del tiempo para esconderse (según el tamaño de partida, editable), tiempo del escondido, pausas y descansos, Move y «Encontrado» con los minutos de cartas de tiempo que tenga en la mano. Lista de rondas con el ganador (el tiempo más largo). Avisa (y vibra) al acabar el tiempo para esconderse y el Move. Sobrevive a recargar o cerrar la página.
- El tiempo del escondido empieza a contar cuando acaba el tiempo para esconderse (como en el programa) y se para en pausas, descansos y Move.
- **Move:** el escondido dice su estación de antes, que queda marcada en morado en el mapa; las preguntas pasan al historial de la ronda y siguen contando para el coste al repetirlas; el reloj se para lo que dure el Move (por defecto, el tiempo para esconderse; se pone el de la carta). Empezar ronda nueva borra preguntas e historial.
- **Termómetro con GPS:** «Empezar aquí» marca el inicio en tu posición, sigue la distancia recorrida en línea recta y avisa (con vibración) al llegar a la distancia de la pregunta; «Terminar aquí» marca el final. Los fallos pasajeros del GPS no cortan el seguimiento.

## Exclusiones del mapa

- **No** se excluye el aeropuerto: su zona pública es un escondite válido.
- **Zonas de criminalidad: por ahora no se excluye ninguna** (decidido el 30/10/2026). Se retomará más adelante, si se ve necesario. Lo estudiado:
  - Por municipio solo hay datos oficiales del Ministerio del Interior. En el 1.er trimestre de 2026 la tasa más alta es la de Madrid capital (14,2 delitos por 1.000 habitantes, frente a 5,4–11 en el resto), inflada por los hurtos a turistas: no sirve para excluir.
  - Por distrito o barrio no hay datos oficiales de delitos; las detenciones de la Policía Municipal (Centro 152 al mes, Puente de Vallecas 95, Carabanchel 74) reflejan sobre todo dónde hay más gente y policía. No se propone excluir ningún municipio ni distrito entero.
  - Propuesta guardada para el futuro: excluir solo la **Cañada Real Galiana, sectores 2 a 6** (zonas habitadas según OpenStreetMap, con 100 m de margen; unos 3,8 km²), dejando el sector 1 (Coslada), que se está regularizando. Solo afectaría a la zona de escondite de Rivas Urbanizaciones (L9), que perdería el 20 % de su círculo. Polígonos en `data-src/propuesta_canada_real.geojson`.
- Se excluyen estaciones que no reciban al menos **1 tren/hora** de una misma línea. Es una regla de casa (como en el programa): el reglamento no fija ninguna frecuencia mínima. Horario de prueba: laborables de 6:00 a 18:00 (octubre de 2026). Lo más probable es jugar en fin de semana; el horario definitivo se fija cuando haya una fecha concreta (en fin de semana pasan menos trenes y es probable que queden fuera más estaciones).

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
| Mercados municipales | 49 | Mercados cubiertos «Mercado…» |
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
| Masas de agua | 51 | Embalses y lagunas de ≥ 2 ha (distancia al «icono») |
| Montañas | 342 | ≥ 1.200 m |
| Ríos | 8 | Manzanares, Jarama, Henares, Guadarrama, Tajo, Tajuña, Lozoya, Alberche |
| Alta velocidad | — | Vías de alta velocidad dentro de la Comunidad |

Fuente de los datos: © colaboradores de OpenStreetMap (ODbL), extraídos el 29–30/10/2026 y revisados a mano contra Google Maps. Límites municipales: Instituto Geográfico Nacional.
