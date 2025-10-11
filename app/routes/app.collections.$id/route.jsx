import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import {
  Page,
  Layout,
  Card,
  DataTable,
  EmptyState,
  Pagination,
  Text,
  BlockStack,
  Thumbnail,
  TextField,
  Tabs,
  Button,
  InlineStack,
} from "@shopify/polaris";
import { useState, useMemo } from "react";
import { authenticate } from "../../shopify.server";

const PRODUCTS_PER_PAGE = 10;

export async function loader({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const collectionId = `gid://shopify/Collection/${params.id}`;
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  const response = await admin.graphql(
    `#graphql
      query getCollection($id: ID!) {
        collection(id: $id) {
          id
          title
          products(first: 250) {
            edges {
              node {
                id
                title
                featuredImage {
                  url
                  altText
                }
                priceRangeV2 {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                }
                totalInventory
                status
                variants(first: 1) {
                  edges {
                    node {
                      id
                      barcode
                      inventoryItem {
                        measurement {
                          weight {
                            unit
                            value
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
    {
      variables: { id: collectionId },
    }
  );

  const data = await response.json();
  
  if (!data.data.collection) {
    throw new Response("Collection not found", { status: 404 });
  }

  const allProducts = data.data.collection.products.edges
    .map(({ node }) => {
      const variant = node.variants.edges[0]?.node;
      const weightData = variant?.inventoryItem?.measurement?.weight;
      
      let weightDisplay = "N/A";
      if (weightData?.value) {
        const unit = weightData.unit?.toLowerCase() || '';
        weightDisplay = `${weightData.value} ${unit}`;
      }

      return {
        id: node.id,
        title: node.title || "N/A",
        image: node.featuredImage?.url || null,
        imageAlt: node.featuredImage?.altText || node.title,
        weight: weightDisplay,
        price: node.priceRangeV2.minVariantPrice,
        barcode: variant?.barcode || "N/A",
        availableUnits: node.totalInventory || 0,
      };
    });

  const collection = {
    id: data.data.collection.id,
    title: data.data.collection.title,
    products: allProducts,
  };

  return { collection };
}

export default function ProductsPage() {
  const { collection } = useLoaderData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState(0);

  const formatPrice = (price) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: price.currencyCode,
    }).format(price.amount);
  };

  // Filter products by stock status
  const stockFilteredProducts = useMemo(() => {
    const allProducts = collection?.products || [];
    
    if (selectedTab === 0) {
      // In Stock tab - products with availableUnits > 0
      return allProducts.filter((product) => product.availableUnits > 0);
    } else {
      // Sold Out tab - products with availableUnits === 0
      return allProducts.filter((product) => product.availableUnits === 0);
    }
  }, [collection?.products, selectedTab]);

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return stockFilteredProducts;
    }

    const query = searchQuery.toLowerCase();
    return stockFilteredProducts.filter((product) => {
      return (
        product.title.toLowerCase().includes(query) ||
        product.barcode.toLowerCase().includes(query) ||
        product.weight.toLowerCase().includes(query)
      );
    });
  }, [stockFilteredProducts, searchQuery]);

  // Pagination logic
  const totalProducts = filteredProducts.length;
  const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE);
  const currentPage = Math.min(
    Math.max(1, parseInt(searchParams.get("page") || "1", 10)),
    totalPages || 1
  );

  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const endIndex = startIndex + PRODUCTS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    setSearchParams({ page: newPage.toString() });
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setSearchParams({ page: "1" }); // Reset to first page on search
  };

  const handleTabChange = (newTab) => {
    setSelectedTab(newTab);
    setSearchQuery(""); // Clear search when switching tabs
    setSearchParams({ page: "1" }); // Reset to first page
  };

  const handleProductClick = (productId) => {
    const numericId = productId.split('/').pop();
    navigate(`/app/products/${numericId}`);
  };

  // Export to Excel function
  const exportToExcel = () => {
    const productsToExport = stockFilteredProducts;
    
    if (productsToExport.length === 0) {
      alert("No products to export");
      return;
    }

    // Create CSV content
    const headers = ["Product Name", "Weight", "Price", "Barcode", "Available Units"];
    const csvRows = [headers.join(",")];

    productsToExport.forEach((product) => {
      const row = [
        `"${product.title.replace(/"/g, '""')}"`, // Escape quotes in title
        `"${product.weight}"`,
        formatPrice(product.price),
        `"${product.barcode}"`,
        product.availableUnits,
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    
    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    const tabName = selectedTab === 0 ? "InStock" : "SoldOut";
    const fileName = `${collection?.title || "Products"}_${tabName}_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const rows = paginatedProducts.map((product) => [
    <Thumbnail
      key={`thumb-${product.id}`}
      source={product.image || "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"}
      alt={product.imageAlt}
      size="small"
    />,
    <button
      type="button"
      key={`btn-${product.id}`}
      onClick={() => handleProductClick(product.id)}
      style={{
        background: "none",
        border: "none",
        color: "#2c6ecb",
        cursor: "pointer",
        textAlign: "left",
        padding: 0,
        font: "inherit",
      }}
    >
      {product.title}
    </button>,
    product.weight,
    formatPrice(product.price),
    product.barcode,
    product.availableUnits.toString(),
  ]);

  const tabs = [
    {
      id: "in-stock",
      content: "In Stock",
      panelID: "in-stock-panel",
    },
    {
      id: "sold-out",
      content: "Sold Out",
      panelID: "sold-out-panel",
    },
  ];

  return (
    <Page
      title={collection?.title || "Products"}
      backAction={{ content: "Collections", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <TextField
                      label="Search products"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      placeholder="Search by name, barcode, or weight..."
                      autoComplete="off"
                      clearButton
                      onClearButtonClick={() => handleSearchChange("")}
                    />
                    <div style={{ marginTop: "20px", marginLeft: "16px" }}>
                      <Button onClick={exportToExcel} disabled={stockFilteredProducts.length === 0}>
                        Export to Excel
                      </Button>
                    </div>
                  </InlineStack>
                  
                  <Text variant="headingMd" as="h2">
                    Products ({totalProducts} {searchQuery ? "found" : selectedTab === 0 ? "in stock" : "sold out"})
                  </Text>
                  
                  {totalProducts === 0 ? (
                    <EmptyState
                      heading={searchQuery ? "No products found" : `No ${selectedTab === 0 ? "in stock" : "sold out"} products`}
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>{searchQuery ? "Try adjusting your search terms." : `There are no ${selectedTab === 0 ? "in stock" : "sold out"} products in this collection.`}</p>
                    </EmptyState>
                  ) : (
                    <DataTable
                      columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                      headings={["Image", "Product Name", "Weight", "Price", "Barcode", "Available Units"]}
                      rows={rows}
                    />
                  )}
                </BlockStack>
              </Tabs>
            </Card>
            
            {totalPages > 1 && (
              <Card>
                <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
                  <Pagination
                    hasPrevious={currentPage > 1}
                    onPrevious={() => handlePageChange(currentPage - 1)}
                    hasNext={currentPage < totalPages}
                    onNext={() => handlePageChange(currentPage + 1)}
                    label={`Page ${currentPage} of ${totalPages}`}
                  />
                </div>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}