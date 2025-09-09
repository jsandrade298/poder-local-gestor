import React, { memo, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { GripVertical, GripHorizontal, CalendarIcon, Trash2, Plus } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PlanoAcaoTableProps {
  filteredActions: any[];
  isLoading: boolean;
  columnWidths: Record<string, number>;
  editingCell: {actionId: string, field: string} | null;
  editingValue: string;
  hoveredRowIndex: number | null;
  eixos: any[];
  prioridades: any[];
  temas: any[];
  statusAcao: any[];
  usuarios: any[];
  handleDragEnd: (result: any) => void;
  handleToggleConcluida: (action: any) => void;
  handleQuickEdit: (action: any, field: string, value: any) => void;
  handleCellEdit: (actionId: string, field: string, currentValue: string) => void;
  handleCellSave: () => void;
  handleCellCancel: () => void;
  setEditingValue: (value: string) => void;
  setHoveredRowIndex: (index: number | null) => void;
  handleInsertAction: (position: number) => void;
  deleteAction: any;
  updateAction: any;
  handleResizeStart?: (columnName: string, e: React.MouseEvent) => void;
  isMaximized?: boolean;
}

export const PlanoAcaoTable = memo(function PlanoAcaoTable({
  filteredActions,
  isLoading,
  columnWidths,
  editingCell,
  editingValue,
  hoveredRowIndex,
  eixos,
  prioridades,
  temas,
  statusAcao,
  usuarios,
  handleDragEnd,
  handleToggleConcluida,
  handleQuickEdit,
  handleCellEdit,
  handleCellSave,
  handleCellCancel,
  setEditingValue,
  setHoveredRowIndex,
  handleInsertAction,
  deleteAction,
  updateAction,
  handleResizeStart,
  isMaximized = false
}: PlanoAcaoTableProps) {
  
  // Memoizar componente para inserção entre linhas
  const InsertRow = memo(({ index }: { index: number }) => (
    <tr 
      className="group cursor-pointer hover:bg-muted/50 transition-none"
      onMouseEnter={() => setHoveredRowIndex(index)}
      onMouseLeave={() => setHoveredRowIndex(null)}
      onClick={() => handleInsertAction(index)}
    >
      <td colSpan={12} className="p-2 text-center">
        <div className={cn(
          "flex items-center justify-center gap-2 text-muted-foreground",
          hoveredRowIndex === index ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Adicionar nova ação aqui</span>
        </div>
      </td>
    </tr>
  ));

  // Memoizar cálculos pesados
  const tableMinWidth = useMemo(() => 
    Object.values(columnWidths).reduce((a, b) => a + b, 80), 
    [columnWidths]
  );

  return (
    <Table 
      className="relative w-full" 
      style={{ minWidth: tableMinWidth, contain: 'layout style paint' }}
    >
      {/* Header fixo com backdrop blur */}
      <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm border-b shadow-sm z-10">
        <TableRow>
          <TableHead className="w-12">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </TableHead>
          <TableHead className="w-12">
            <Checkbox />
          </TableHead>
          <TableHead style={{ width: columnWidths.eixo }} className={!isMaximized ? "relative" : "relative"}>
            Eixo
            {handleResizeStart && (
              <div 
                className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                onMouseDown={(e) => handleResizeStart('eixo', e)}
              >
                <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
              </div>
            )}
          </TableHead>
          <TableHead style={{ width: columnWidths.prioridade }} className={!isMaximized ? "relative" : "relative"}>
            Prioridade
            {handleResizeStart && (
              <div 
                className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                onMouseDown={(e) => handleResizeStart('prioridade', e)}
              >
                <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
              </div>
            )}
          </TableHead>
          <TableHead style={{ width: columnWidths.tema }} className={!isMaximized ? "relative" : "relative"}>
            Tema
            {handleResizeStart && (
              <div 
                className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                onMouseDown={(e) => handleResizeStart('tema', e)}
              >
                <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
              </div>
            )}
          </TableHead>
          <TableHead style={{ width: columnWidths.acao }} className={!isMaximized ? "relative" : "relative"}>
            Ação
            {handleResizeStart && (
              <div 
                className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                onMouseDown={(e) => handleResizeStart('acao', e)}
              >
                <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
              </div>
            )}
          </TableHead>
          <TableHead style={{ width: columnWidths.responsavel }} className={!isMaximized ? "relative" : "relative"}>
            Responsável
            {handleResizeStart && (
              <div 
                className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                onMouseDown={(e) => handleResizeStart('responsavel', e)}
              >
                <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
              </div>
            )}
          </TableHead>
          <TableHead style={{ width: columnWidths.apoio }} className={!isMaximized ? "relative" : "relative"}>
            Apoio
            {handleResizeStart && (
              <div 
                className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                onMouseDown={(e) => handleResizeStart('apoio', e)}
              >
                <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
              </div>
            )}
          </TableHead>
          <TableHead style={{ width: columnWidths.status }} className={!isMaximized ? "relative" : "relative"}>
            Status
            {handleResizeStart && (
              <div 
                className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                onMouseDown={(e) => handleResizeStart('status', e)}
              >
                <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
              </div>
            )}
          </TableHead>
          <TableHead style={{ width: columnWidths.prazo }} className={!isMaximized ? "relative" : "relative"}>
            Prazo
            {handleResizeStart && (
              <div 
                className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                onMouseDown={(e) => handleResizeStart('prazo', e)}
              >
                <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
              </div>
            )}
          </TableHead>
          <TableHead style={{ width: columnWidths.atualizacao }} className={!isMaximized ? "relative" : "relative"}>
            Atualização
            {handleResizeStart && (
              <div 
                className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                onMouseDown={(e) => handleResizeStart('atualizacao', e)}
              >
                <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
              </div>
            )}
          </TableHead>
          <TableHead style={{ width: columnWidths.excluir }}>
            Excluir
          </TableHead>
        </TableRow>
      </TableHeader>
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="actions-table">
          {(provided, snapshot) => (
            <TableBody 
              {...provided.droppableProps} 
              ref={provided.innerRef}
              className={cn(
                snapshot.isDraggingOver && "bg-accent/30"
              )}
            >
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredActions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8">
                    Nenhuma ação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  <InsertRow index={0} />
                  {filteredActions.map((action, index) => (
                    <React.Fragment key={action.id}>
                      <Draggable 
                        draggableId={action.id} 
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <TableRow 
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              action.concluida ? "opacity-60" : "",
                              snapshot.isDragging && "shadow-xl bg-background z-50 border-2 border-primary/50",
                              "relative"
                            )}
                            style={{
                              ...provided.draggableProps.style,
                              // Garantir que o item em drag tenha z-index alto
                              zIndex: snapshot.isDragging ? 9999 : 'auto'
                            }}
                          >
                            {/* Handle de drag */}
                            <TableCell className="w-12 p-2">
                              <div 
                                {...provided.dragHandleProps} 
                                className="cursor-grab active:cursor-grabbing hover:bg-accent/50 p-1 rounded"
                                onMouseDown={(e) => {
                                  // Garantir que outros eventos não interfiram
                                  e.stopPropagation();
                                }}
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </TableCell>
                            
                            {/* Checkbox */}
                            <TableCell className="w-12">
                              <Checkbox
                                checked={action.concluida}
                                onCheckedChange={() => handleToggleConcluida(action)}
                              />
                            </TableCell>

                            {/* Eixo */}
                            <TableCell style={{ width: columnWidths.eixo }}>
                              <Select 
                                value={action.eixo_id || ""} 
                                onValueChange={(value) => handleQuickEdit(action, 'eixo_id', value)}
                              >
                                <SelectTrigger className="border-0 h-auto p-0 hover:bg-muted">
                                  <Badge 
                                    variant="outline" 
                                    style={{ 
                                      borderColor: action.eixos?.cor, 
                                      color: action.eixos?.cor 
                                    }}
                                  >
                                    {action.eixos?.nome || 'Selecionar eixo'}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  {eixos.map((eixo) => (
                                    <SelectItem key={eixo.id} value={eixo.id}>
                                      <div className="flex items-center gap-2">
                                        <div 
                                          className="w-3 h-3 rounded-full" 
                                          style={{ backgroundColor: eixo.cor }}
                                        />
                                        {eixo.nome}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>

                            {/* Prioridade */}
                            <TableCell style={{ width: columnWidths.prioridade }}>
                              <Select 
                                value={action.prioridade_id || ""} 
                                onValueChange={(value) => handleQuickEdit(action, 'prioridade_id', value)}
                              >
                                <SelectTrigger className="border-0 h-auto p-0 hover:bg-muted">
                                  <Badge 
                                    variant="outline"
                                    style={{ 
                                      borderColor: action.prioridades_acao?.cor, 
                                      color: action.prioridades_acao?.cor 
                                    }}
                                  >
                                    {action.prioridades_acao?.nome || 'Selecionar prioridade'}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  {prioridades.map((prioridade) => (
                                    <SelectItem key={prioridade.id} value={prioridade.id}>
                                      <div className="flex items-center gap-2">
                                        <div 
                                          className="w-3 h-3 rounded-full" 
                                          style={{ backgroundColor: prioridade.cor }}
                                        />
                                        {prioridade.nome}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>

                            {/* Tema */}
                            <TableCell style={{ width: columnWidths.tema }}>
                              <Select 
                                value={action.tema_id || ""} 
                                onValueChange={(value) => handleQuickEdit(action, 'tema_id', value)}
                              >
                                <SelectTrigger className="border-0 h-auto p-0 hover:bg-muted">
                                  <Badge variant="secondary">
                                    {action.temas_acao?.nome || 'Selecionar tema'}
                                  </Badge>
                                </SelectTrigger>
                                 <SelectContent>
                                   {temas.map((tema) => (
                                     <SelectItem key={tema.id} value={tema.id}>
                                       {tema.nome}
                                     </SelectItem>
                                   ))}
                                 </SelectContent>
                              </Select>
                            </TableCell>

                            {/* Ação */}
                            <TableCell style={{ width: columnWidths.acao }}>
                              {editingCell?.actionId === action.id && editingCell?.field === 'acao' ? (
                                <AutoResizeTextarea
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onSave={handleCellSave}
                                  onCancel={handleCellCancel}
                                  width={columnWidths.acao}
                                  placeholder="Digite a ação..."
                                />
                              ) : (
                                <div 
                                  className="cursor-pointer p-2 hover:bg-muted rounded min-h-[40px] overflow-hidden text-ellipsis"
                                  style={{ maxWidth: columnWidths.acao - 20 }}
                                  onClick={() => handleCellEdit(action.id, 'acao', action.acao)}
                                  title={action.acao}
                                >
                                  {action.acao || 'Clique para editar'}
                                </div>
                              )}
                            </TableCell>

                             {/* Responsável */}
                             <TableCell style={{ width: columnWidths.responsavel }}>
                               {editingCell?.actionId === action.id && editingCell?.field === 'responsavel' ? (
                                 <AutoResizeTextarea
                                   value={editingValue}
                                   onChange={(e) => setEditingValue(e.target.value)}
                                   onSave={handleCellSave}
                                   onCancel={handleCellCancel}
                                   width={columnWidths.responsavel}
                                   placeholder="Digite o responsável..."
                                 />
                               ) : (
                                  <div 
                                    className="cursor-pointer p-2 hover:bg-muted rounded min-h-[40px] overflow-hidden text-ellipsis"
                                    style={{ maxWidth: columnWidths.responsavel - 20 }}
                                    onClick={() => handleCellEdit(action.id, 'responsavel', action.responsavel?.nome || '')}
                                    title={action.responsavel?.nome}
                                  >
                                    {action.responsavel?.nome || 'Clique para editar'}
                                  </div>
                               )}
                             </TableCell>

                            {/* Apoio */}
                            <TableCell style={{ width: columnWidths.apoio }}>
                              {editingCell?.actionId === action.id && editingCell?.field === 'apoio' ? (
                                <AutoResizeTextarea
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onSave={handleCellSave}
                                  onCancel={handleCellCancel}
                                  width={columnWidths.apoio}
                                  placeholder="Digite o apoio..."
                                />
                              ) : (
                                <div 
                                  className="cursor-pointer p-2 hover:bg-muted rounded min-h-[40px] overflow-hidden text-ellipsis"
                                  style={{ maxWidth: columnWidths.apoio - 20 }}
                                  onClick={() => handleCellEdit(action.id, 'apoio', action.apoio)}
                                  title={action.apoio}
                                >
                                  {action.apoio || 'Clique para editar'}
                                </div>
                              )}
                            </TableCell>

                            {/* Status */}
                            <TableCell style={{ width: columnWidths.status }}>
                              <Select 
                                value={action.status_id || ""} 
                                onValueChange={(value) => handleQuickEdit(action, 'status_id', value)}
                              >
                                <SelectTrigger className="border-0 h-auto p-0 hover:bg-muted">
                                  <Badge 
                                    variant="outline"
                                    style={{ 
                                      borderColor: action.status_acao?.cor, 
                                      color: action.status_acao?.cor 
                                    }}
                                  >
                                    {action.status_acao?.nome || 'Selecionar status'}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  {statusAcao.map((status) => (
                                    <SelectItem key={status.id} value={status.id}>
                                      <div className="flex items-center gap-2">
                                        <div 
                                          className="w-3 h-3 rounded-full" 
                                          style={{ backgroundColor: status.cor }}
                                        />
                                        {status.nome}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>

                            {/* Prazo */}
                            <TableCell style={{ width: columnWidths.prazo }}>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    className="w-full justify-start text-left font-normal h-auto p-2 hover:bg-muted"
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {action.prazo ? format(new Date(action.prazo), 'dd/MM/yyyy') : 'Selecionar data'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    selected={action.prazo ? new Date(action.prazo) : undefined}
                                    onSelect={(date) => {
                                      if (date) {
                                        handleQuickEdit(action, 'prazo', format(date, 'yyyy-MM-dd'));
                                      }
                                    }}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </TableCell>

                            {/* Atualização */}
                            <TableCell style={{ width: columnWidths.atualizacao }}>
                              {editingCell?.actionId === action.id && editingCell?.field === 'atualizacao' ? (
                                <AutoResizeTextarea
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onSave={handleCellSave}
                                  onCancel={handleCellCancel}
                                  width={columnWidths.atualizacao}
                                  placeholder="Digite a atualização..."
                                />
                              ) : (
                                <div 
                                  className="cursor-pointer p-2 hover:bg-muted rounded min-h-[40px] overflow-hidden whitespace-pre-wrap"
                                  style={{ maxWidth: columnWidths.atualizacao - 20 }}
                                  onClick={() => handleCellEdit(action.id, 'atualizacao', action.atualizacao)}
                                  title={action.atualizacao}
                                >
                                  {action.atualizacao || 'Clique para editar'}
                                </div>
                              )}
                            </TableCell>

                            {/* Excluir */}
                            <TableCell className="w-20">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir esta ação? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteAction.mutate(action.id)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        )}
                      </Draggable>
                      <InsertRow index={index + 1} />
                    </React.Fragment>
                  ))}
                </>
              )}
              {provided.placeholder}
            </TableBody>
          )}
        </Droppable>
      </DragDropContext>
    </Table>
  );
});