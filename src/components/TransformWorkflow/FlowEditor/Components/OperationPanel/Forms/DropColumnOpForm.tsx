import React, { useEffect, useState } from 'react';
import { OperationNodeData } from '../../Canvas';
import { useSession } from 'next-auth/react';
import { Box, Button, FormHelperText, Grid, Typography } from '@mui/material';
import { OPERATION_NODE, SRC_MODEL_NODE } from '../../../constant';
import { DbtSourceModel } from '../../Canvas';
import { httpGet, httpPost, httpPut } from '@/helpers/http';
import { ColumnData } from '../../Nodes/DbtSourceModelNode';

import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import InputAdornment from '@mui/material/InputAdornment';
import { OperationFormProps } from '../../OperationConfigLayout';
import { Autocomplete } from '@/components/UI/Autocomplete/Autocomplete';
import Input from '@/components/UI/Input/Input';

interface DropDataConfig {
  columns: string[];
  source_columns: string[];
  other_inputs: any[];
}

const DropColumnOp = ({
  node,
  operation,
  sx,
  continueOperationChain,
  action,
  setLoading,
}: OperationFormProps) => {
  const { data: session } = useSession();
  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const [valid, setValid] = useState(true);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [inputModels, setInputModels] = useState<any[]>([]); // used for edit; will have information about the input nodes to the operation being edited
  const [column, setColumn] = useState('');
  const nodeData: any =
    node?.type === SRC_MODEL_NODE
      ? (node?.data as DbtSourceModel)
      : node?.type === OPERATION_NODE
      ? (node?.data as OperationNodeData)
      : {};

  const fetchAndSetSourceColumns = async () => {
    if (node?.type === SRC_MODEL_NODE) {
      try {
        const data: ColumnData[] = await httpGet(
          session,
          `warehouse/table_columns/${nodeData.schema}/${nodeData.input_name}`
        );
        setSrcColumns(data.map((col: ColumnData) => col.name));
      } catch (error) {
        console.log(error);
      }
    }

    if (node?.type === OPERATION_NODE) {
      setSrcColumns(nodeData.output_cols);
    }
  };

  const handleAddColumn = (column: string) => {
    setSelectedColumns((prevColumns) => [...prevColumns, column]);
  };

  const handleRemoveColumn = (column: string) => {
    setSelectedColumns((prevColumns) =>
      prevColumns.filter((col) => col !== column)
    );
  };

  const handleSave = async () => {
    try {
      if (selectedColumns.length < 1) {
        setValid(false);
        return;
      }
      const postData = {
        op_type: operation.slug,
        source_columns: srcColumns,
        other_inputs: [],
        config: { columns: selectedColumns },
        input_uuid: node?.type === SRC_MODEL_NODE ? node?.data.id : '',
        target_model_uuid: nodeData.target_model_id || '',
      };

      // api call
      setLoading(true);
      let operationNode: any;
      if (action === 'create') {
        operationNode = await httpPost(
          session,
          `transform/dbt_project/model/`,
          postData
        );
      } else if (action === 'edit') {
        // need this input to be sent for the first step in chain
        postData.input_uuid =
          inputModels.length > 0 && inputModels[0]?.uuid
            ? inputModels[0].uuid
            : '';
        operationNode = await httpPut(
          session,
          `transform/dbt_project/model/operations/${node?.id}/`,
          postData
        );
      }

      continueOperationChain(operationNode);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAndSetConfigForEdit = async () => {
    try {
      setLoading(true);
      const { config }: OperationNodeData = await httpGet(
        session,
        `transform/dbt_project/model/operations/${node?.id}/`
      );
      const { config: opConfig, input_models } = config;
      setInputModels(input_models);

      // form data; will differ based on operations in progress
      const { source_columns, columns }: DropDataConfig = opConfig;
      setSrcColumns(source_columns);

      // pre-fill form
      setSelectedColumns(columns);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (['edit', 'view'].includes(action)) {
      fetchAndSetConfigForEdit();
    } else {
      fetchAndSetSourceColumns();
    }
  }, [session, node]);

  return (
    <Box sx={{ ...sx, marginTop: '17px', padding: '20px' }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Typography variant="h6">Select Columns to Drop</Typography>
        </Grid>
        {[...selectedColumns].map((column, index) => (
          <Grid item xs={12} key={index}>
            <Grid container spacing={1}>
              <Grid item xs={12}>
                <Input
                  fieldStyle="transformation"
                  disabled
                  variant="outlined"
                  value={column}
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={
                            action !== 'view'
                              ? () => handleRemoveColumn(column)
                              : undefined
                          }
                        >
                          <CloseIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </Grid>
        ))}
        <Grid item xs={12}>
          <Autocomplete
            disabled={action === 'view'}
            value={column}
            inputValue={column}
            fieldStyle="transformation"
            options={srcColumns
              .filter((col) => !selectedColumns.includes(col))
              .sort((a, b) => a.localeCompare(b))}
            label="Select Column to Drop"
            onChange={(value: any) => {
              if (value) {
                handleAddColumn(value);
                setColumn('');
                setValid(true);
              }
            }}
          />
        </Grid>
        {!valid && (
          <FormHelperText sx={{ color: 'red', ml: 3 }}>
            Please select atleast 1 column
          </FormHelperText>
        )}
        <Grid item xs={12}>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={action === 'view'}
          >
            Save
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DropColumnOp;
